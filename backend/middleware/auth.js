const jwt = require('jsonwebtoken');
const path = require('path');
const { db } = require('../database');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'farmease_super_secret_key_123_abc';

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Invalid token format.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check database to ensure user still exists and is active
    const user = await db.get('SELECT is_active FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ message: 'User account has been deleted.' });
    }
    if (!user.is_active) {
      return res.status(401).json({ message: 'User account has been deactivated.' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Optional validation by role
function checkRole(roles = []) {
  return (req, res, next) => {
    // If the user has 'supervisor' role, they bypass role checks for 'admin', 'employee', and 'worker'
    const isSupervisorWithPowers = req.user && req.user.role === 'supervisor' && (
      roles.includes('admin') || roles.includes('employee') || roles.includes('worker')
    );

    if (!req.user || (!roles.includes(req.user.role) && !isSupervisorWithPowers)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  checkRole,
  JWT_SECRET
};
