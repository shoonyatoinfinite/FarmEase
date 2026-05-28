const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken } = require('../middleware/auth');

// GET /api/notifications
// Retrieve all notifications for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const list = await db.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving notifications.' });
  }
});

// PATCH /api/notifications/mark-read
// Mark all notifications as read
router.patch('/mark-read', verifyToken, async (req, res) => {
  try {
    await db.run(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating notifications.' });
  }
});

// PATCH /api/notifications/:id/read
// Mark a specific notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    await db.run(
      `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [notificationId, req.user.id]
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating notification.' });
  }
});

module.exports = router;
