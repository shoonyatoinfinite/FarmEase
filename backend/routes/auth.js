const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { JWT_SECRET, verifyToken } = require('../middleware/auth');
const admin = require('firebase-admin');

// Transient store for OTPs (for simulation)
const otpStore = {}; // phone/email -> { otp, attempts, expires }

// Initialize Firebase Admin SDK
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseProjectId,
        clientEmail: firebaseClientEmail,
        privateKey: firebasePrivateKey.replace(/\\n/g, '\n')
      })
    });
    console.log("🚀 Firebase Admin SDK initialized successfully.");
  } catch (err) {
    console.error("❌ Firebase Admin SDK initialization error:", err);
  }
} else {
  console.warn("⚠️ Firebase credentials missing. Running in Developer Simulation Mode (accepts base64 mock tokens).");
}

// Google Token verification helper supporting Developer Simulation
async function verifyGoogleToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID Token is required.');
  }

  // Developer Simulation Mode token handling
  if (idToken.startsWith('mock_google_token_')) {
    try {
      const payloadBase64 = idToken.replace('mock_google_token_', '');
      const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const parsed = JSON.parse(decodedJson);
      return {
        email: parsed.email || 'mock_user@gmail.com',
        name: parsed.name || 'Mock User',
        uid: `mock-uid-${parsed.email || 'default'}`
      };
    } catch (err) {
      console.warn("Failed parsing mock base64 token payload. Falling back to default.");
      return {
        email: 'mock_user@gmail.com',
        name: 'Mock User',
        uid: 'mock-uid-default'
      };
    }
  }

  // Real Firebase ID Token verification
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      email: decodedToken.email,
      name: decodedToken.name,
      uid: decodedToken.uid
    };
  } catch (error) {
    console.error("Firebase ID Token verification failed:", error.message);
    throw new Error('Invalid Google ID Token.');
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, phone, email, password, pin, role, upi_id, address, village } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Name, Phone, and Password are required.' });
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: 'Phone number must be exactly 10 numeric digits.' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this phone number already exists.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    // Role defaults to farmer if not specified
    const userRole = role || 'farmer';
    const userLanguage = 'hindi'; // Default as per schema

    const result = await db.run(
      `INSERT INTO users (name, phone, email, password, pin, role, upi_id, address, village, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, hashedPassword, pin || null, userRole, upi_id || null, address || null, village || null, userLanguage]
    );

    const userId = result.lastID;

    // Create a farm record automatically for farmers if farm data provided or as placeholder
    if (userRole === 'farmer') {
      await db.run(
        `INSERT INTO farms (farmer_id, location_lat, location_lng, area_acres, soil_type) VALUES (?, ?, ?, ?, ?)`,
        [userId, 29.6857, 76.9905, 5.0, 'Alluvial'] // Default coordinates
      );
    }

    res.status(201).json({ message: 'Registration successful! Redirecting to login...', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});


// POST /api/auth/google-login
router.post('/google-login', async (req, res) => {
  const { idToken } = req.body;

  try {
    const googleUser = await verifyGoogleToken(idToken);
    const { email, name } = googleUser;

    // Look up user by email in PostgreSQL database
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (user) {
      if (!user.is_active) {
        return res.status(403).json({ message: 'Account is deactivated.' });
      }

      // Generate JWT Token for existing user
      const token = jwt.sign(
        { id: user.id, name: user.name, role: user.role, language: user.language },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Login successful!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          language: user.language,
          village: user.village,
          address: user.address,
          upi_id: user.upi_id
        }
      });
    } else {
      // User does not exist, return PENDING_REGISTRATION status
      return res.json({
        status: 'PENDING_REGISTRATION',
        email,
        name,
        message: 'Google authentication successful! Please complete registration details.'
      });
    }
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Authentication failed.' });
  }
});

// POST /api/auth/google-register
router.post('/google-register', async (req, res) => {
  const { idToken, phone, role, upi_id, address, village, pin } = req.body;

  if (!phone || !village) {
    return res.status(400).json({ message: 'Phone and Village are required fields.' });
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ message: 'Phone number must be exactly 10 numeric digits.' });
  }

  try {
    const googleUser = await verifyGoogleToken(idToken);
    const { email, name } = googleUser;

    // Ensure user email is unique
    const existingUserByEmail = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    // Ensure user phone is unique
    const existingUserByPhone = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existingUserByPhone) {
      return res.status(400).json({ message: 'User with this phone number already exists.' });
    }

    // Hash a placeholder password since Google Auth is used
    const dummyPassword = bcrypt.hashSync(Math.random().toString(36).substring(2), 8);
    const userRole = role || 'farmer';
    const userLanguage = 'hindi'; // Default as per schema

    const result = await db.run(
      `INSERT INTO users (name, phone, email, password, pin, role, upi_id, address, village, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, dummyPassword, pin || '111111', userRole, upi_id || null, address || null, village, userLanguage]
    );

    const userId = result.lastID;

    // Auto-create farm profile if Farmer
    if (userRole === 'farmer') {
      await db.run(
        `INSERT INTO farms (farmer_id, location_lat, location_lng, area_acres, soil_type) VALUES (?, ?, ?, ?, ?)`,
        [userId, 29.6857, 76.9905, 5.0, 'Alluvial']
      );
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: userId, name, role: userRole, language: userLanguage },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        id: userId,
        name,
        email,
        phone,
        role: userRole,
        language: userLanguage,
        village,
        address: address || null,
        upi_id: upi_id || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { loginId, password, pin } = req.body; // loginId can be email or phone

  if (!loginId) {
    return res.status(400).json({ message: 'Email or Phone is required.' });
  }

  try {
    // Find user by phone or email
    const user = await db.get('SELECT * FROM users WHERE phone = ? OR email = ?', [loginId, loginId]);
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is deactivated.' });
    }

    // Determine authentication method: Password or PIN
    if (pin) {
      // Validate PIN
      if (user.pin !== pin) {
        return res.status(400).json({ message: 'Invalid 4-6 digit PIN.' });
      }
    } else if (password) {
      // Validate Password
      const isPasswordValid = bcrypt.compareSync(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid Password.' });
      }
    } else {
      return res.status(400).json({ message: 'Password or PIN is required.' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, language: user.language },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        language: user.language,
        village: user.village,
        address: user.address,
        upi_id: user.upi_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// POST /api/auth/forgot-password/request
// Submits a password recovery request for admin review
router.post('/forgot-password/request', async (req, res) => {
  const { phone, last_password, last_pin, name, village, new_password, new_pin } = req.body;

  if (!phone || !last_password || !last_pin || !name || !village || !new_password || !new_pin) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Save request to forgot_password_requests
    await db.run(
      `INSERT INTO forgot_password_requests (phone, last_password, last_pin, name, village, new_password, new_pin, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [phone, last_password, last_pin, name, village, new_password, new_pin]
    );

    // Notify admins and supervisors
    const adminsAndSupervisors = await db.all("SELECT id FROM users WHERE role IN ('admin', 'supervisor')");
    for (const adminUser of adminsAndSupervisors) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Password Reset Request 🔑', ?)`,
        [adminUser.id, `User ${name} (${phone}) has submitted a password recovery request.`]
      );
    }

    res.status(201).json({ message: 'Recovery request successfully submitted for Admin approval!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error submitting recovery request.' });
  }
});

// PATCH /api/auth/profile
// Update user profile details
router.patch('/profile', verifyToken, async (req, res) => {
  const { name, email, address, village, upi_id, password, pin } = req.body;
  const userId = req.user.id;

  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (village !== undefined) { updates.push('village = ?'); params.push(village); }
    if (upi_id !== undefined) { updates.push('upi_id = ?'); params.push(upi_id); }
    
    if (password) {
      updates.push('password = ?');
      params.push(bcrypt.hashSync(password, 8));
    }
    if (pin) {
      updates.push('pin = ?');
      params.push(pin);
    }

    if (updates.length > 0) {
      params.push(userId);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    
    // Generate fresh JWT Token with updated fields
    const token = jwt.sign(
      { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role, language: updatedUser.language },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Profile updated successfully!',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        language: updatedUser.language,
        village: updatedUser.village,
        address: updatedUser.address,
        upi_id: updatedUser.upi_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
});

module.exports = router;
