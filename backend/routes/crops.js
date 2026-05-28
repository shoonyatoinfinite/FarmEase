const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// GET /api/crops/prices
// Public or authenticated lookup for live crop prices
router.get('/prices', async (req, res) => {
  try {
    const prices = await db.all(
      `SELECT cp.*, u.name as updated_by_name 
       FROM crop_prices cp
       LEFT JOIN users u ON cp.updated_by = u.id
       ORDER BY cp.crop_name`
    );
    res.json(prices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving crop prices.' });
  }
});

// POST /api/crops/prices
// Admin only: Set/update crop prices
router.post('/prices', verifyToken, checkRole(['admin']), async (req, res) => {
  const { crop_name, price_per_quintal } = req.body;

  if (!crop_name || !price_per_quintal) {
    return res.status(400).json({ message: 'Crop Name and Price per Quintal are required.' });
  }

  try {
    // Check if the price record for this crop exists
    const existing = await db.get(
      'SELECT id FROM crop_prices WHERE crop_name = ?',
      [crop_name]
    );

    if (existing) {
      // Update
      await db.run(
        `UPDATE crop_prices SET price_per_quintal = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [price_per_quintal, req.user.id, existing.id]
      );
    } else {
      // Insert
      await db.run(
        `INSERT INTO crop_prices (crop_name, price_per_quintal, updated_by) VALUES (?, ?, ?)`,
        [crop_name, price_per_quintal, req.user.id]
      );
    }

    // Dynamic AI Suggestion calculation for demo purposes:
    // If Admin updates the price, simulate a real-time price notification broadcast via WebSockets!
    const updateMessage = `Live rate for ${crop_name} updated to ₹${price_per_quintal}/Quintal.`;
    
    // Broadcast via socket.io if request contains the socket instance
    if (req.io) {
      req.io.emit('price_update_broadcast', {
        crop_name,
        price_per_quintal,
        message: updateMessage
      });
    }

    // Add notification for all farmers
    const farmers = await db.all("SELECT id FROM users WHERE role = 'farmer'");
    for (const f of farmers) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Crop Price Alert 🌾', ?)`,
        [f.id, updateMessage]
      );
    }

    res.json({ message: 'Crop price updated successfully and broadcasted to all users.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating crop price.' });
  }
});

// DELETE /api/crops/prices/:id
// Admin only: Remove a crop from the active price board
router.delete('/prices/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const cropId = parseInt(req.params.id);

  if (isNaN(cropId)) {
    return res.status(400).json({ message: 'Invalid crop id.' });
  }

  try {
    const existing = await db.get('SELECT * FROM crop_prices WHERE id = ?', [cropId]);
    if (!existing) {
      return res.status(404).json({ message: 'Crop not found on price board.' });
    }

    await db.run('DELETE FROM crop_prices WHERE id = ?', [cropId]);

    if (req.io) {
      req.io.emit('price_update_broadcast', {
        crop_name: existing.crop_name,
        removed: true,
        message: `${existing.crop_name} removed from active crop board.`
      });
    }

    res.json({ message: `${existing.crop_name} removed from active crop board.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error removing crop.' });
  }
});

module.exports = router;
