const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken } = require('../middleware/auth');

// GET /api/chat/notifications
// Get notifications for logged-in user
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const list = await db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [req.user.id]
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading notifications.' });
  }
});

// PATCH /api/chat/notifications/read
// Mark notifications as read
router.patch('/notifications/read', verifyToken, async (req, res) => {
  try {
    await db.run(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'Notifications marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error marking notifications read.' });
  }
});

// Helper to resolve peerId to actual admin if peerId is 1
async function getResolvedPeerId(peerId, myId) {
  if (peerId === 1) {
    const admin = await db.get("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
    if (admin && admin.id !== myId) {
      return admin.id;
    }
  }
  return peerId;
}

// GET /api/chat/history/:peer_id
// Get chat history between current user and a peer (unifies admin/supervisor helpdesk)
router.get('/history/:peer_id', verifyToken, async (req, res) => {
  const myId = req.user.id;
  const myRole = req.user.role;
  let peerId = parseInt(req.params.peer_id);
  
  try {
    peerId = await getResolvedPeerId(peerId, myId);

    const isMyAdminOrSupervisor = (myRole === 'admin' || myRole === 'supervisor');
    const peer = await db.get('SELECT role FROM users WHERE id = ?', [peerId]);
    const isPeerAdminOrSupervisor = peer && (peer.role === 'admin' || peer.role === 'supervisor');

    if (isMyAdminOrSupervisor && !isPeerAdminOrSupervisor) {
      // I am admin/supervisor, chatting with a regular user.
      // Mark all messages from this user to any admin/supervisor as read.
      await db.run(
        `UPDATE messages SET is_read = TRUE 
         WHERE receiver_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')) 
           AND sender_id = ?`,
        [peerId]
      );

      // Get messages between this user and any admin/supervisor.
      const history = await db.all(
        `SELECT m.*, u.name as sender_name 
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE (m.sender_id = ? AND m.receiver_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')))
            OR (m.sender_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')) AND m.receiver_id = ?)
         ORDER BY m.sent_at ASC`,
        [peerId, peerId]
      );

      const formattedHistory = history.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        sender_name: msg.sender_name,
        message: msg.message,
        timestamp: msg.sent_at,
        is_read: msg.is_read
      }));

      res.json(formattedHistory);
    } else if (isPeerAdminOrSupervisor && !isMyAdminOrSupervisor) {
      // I am a regular user, chatting with an admin/supervisor desk.
      // Mark all messages from any admin/supervisor to me as read.
      await db.run(
        `UPDATE messages SET is_read = TRUE 
         WHERE receiver_id = ? 
           AND sender_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor'))`,
        [myId]
      );

      // Get messages between me and any admin/supervisor.
      const history = await db.all(
        `SELECT m.*, u.name as sender_name 
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE (m.sender_id = ? AND m.receiver_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')))
            OR (m.sender_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')) AND m.receiver_id = ?)
         ORDER BY m.sent_at ASC`,
        [myId, myId]
      );

      const formattedHistory = history.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        sender_name: msg.sender_name,
        message: msg.message,
        timestamp: msg.sent_at,
        is_read: msg.is_read
      }));

      res.json(formattedHistory);
    } else {
      // Standard peer-to-peer (fallback)
      await db.run(
        'UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND sender_id = ?',
        [myId, peerId]
      );

      const history = await db.all(
        `SELECT m.*, u.name as sender_name 
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE (m.sender_id = ? AND m.receiver_id = ?)
            OR (m.sender_id = ? AND m.receiver_id = ?)
         ORDER BY m.sent_at ASC`,
        [myId, peerId, peerId, myId]
      );

      const formattedHistory = history.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        sender_name: msg.sender_name,
        message: msg.message,
        timestamp: msg.sent_at,
        is_read: msg.is_read
      }));

      res.json(formattedHistory);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading history.' });
  }
});

// POST /api/chat/send
// Send chat message (saves to messages database table and fires socket events to all admins/supervisors)
router.post('/send', verifyToken, async (req, res) => {
  const { receiver_id, message } = req.body;
  const myId = req.user.id;
  const myRole = req.user.role;

  if (!receiver_id || !message) {
    return res.status(400).json({ message: 'Receiver and message content are required.' });
  }

  try {
    let resolvedReceiverId = parseInt(receiver_id);
    resolvedReceiverId = await getResolvedPeerId(resolvedReceiverId, myId);

    const receiver = await db.get('SELECT name, role FROM users WHERE id = ?', [resolvedReceiverId]);
    if (!receiver) {
      return res.status(404).json({ message: 'Recipient not found.' });
    }

    const result = await db.run(
      'INSERT INTO messages (sender_id, receiver_id, message, is_read, sent_at) VALUES (?, ?, ?, FALSE, CURRENT_TIMESTAMP)',
      [myId, resolvedReceiverId, message]
    );

    const newMessageId = result.lastID;

    // Fetch the inserted message to emit
    const insertedMessage = await db.get(
      `SELECT m.*, u.name as sender_name 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [newMessageId]
    );

    const formattedMessage = {
      id: insertedMessage.id,
      sender_id: insertedMessage.sender_id,
      receiver_id: insertedMessage.receiver_id,
      sender_name: insertedMessage.sender_name,
      message: insertedMessage.message,
      timestamp: insertedMessage.sent_at,
      is_read: insertedMessage.is_read
    };

    // Emit real-time events to all relevant rooms
    const adminsAndSupervisors = await db.all("SELECT id FROM users WHERE role IN ('admin', 'supervisor')");
    const isMyAdminOrSupervisor = (myRole === 'admin' || myRole === 'supervisor');
    
    if (req.io) {
      if (isMyAdminOrSupervisor) {
        // Admin/Supervisor sending to a regular user.
        // Notify the recipient user
        req.io.to(`user_${resolvedReceiverId}`).emit('new_chat_message', formattedMessage);
        // Also notify all online admins and supervisors so their screens stay perfectly sync'd!
        for (const adminUser of adminsAndSupervisors) {
          req.io.to(`user_${adminUser.id}`).emit('new_chat_message', formattedMessage);
        }
      } else {
        // A regular user is sending to the Admin Help Desk.
        // Notify the sender
        req.io.to(`user_${myId}`).emit('new_chat_message', formattedMessage);
        // Notify all admins and supervisors
        for (const adminUser of adminsAndSupervisors) {
          req.io.to(`user_${adminUser.id}`).emit('new_chat_message', formattedMessage);
        }
      }
    }

    res.json(formattedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error sending message.' });
  }
});

// GET /api/chat/list
// Get all users for the Admin/Supervisor helpline
router.get('/list', verifyToken, async (req, res) => {
  try {
    // List all active users who are NOT admins or supervisors
    const list = await db.all(
      `SELECT id, name, role, phone, village 
       FROM users 
       WHERE role NOT IN ('admin', 'supervisor') AND is_active = TRUE
       ORDER BY role, name ASC`
    );

    const listWithUnread = await Promise.all(list.map(async (u) => {
      // Count unread messages sent by this user to ANY admin/supervisor
      const unread = await db.get(
        `SELECT COUNT(*) as count FROM messages 
         WHERE sender_id = ? 
           AND receiver_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')) 
           AND is_read = FALSE`,
        [u.id]
      );
      // Fetch latest message between this user and ANY admin/supervisor
      const lastMsg = await db.get(
        `SELECT sent_at FROM messages 
         WHERE (sender_id = ? AND receiver_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')))
            OR (sender_id IN (SELECT id FROM users WHERE role IN ('admin', 'supervisor')) AND receiver_id = ?) 
         ORDER BY sent_at DESC LIMIT 1`,
        [u.id, u.id]
      );

      const unreadCount = unread ? parseInt(unread.count) : 0;
      const latestTime = lastMsg && lastMsg.sent_at ? new Date(lastMsg.sent_at).getTime() : 0;

      return {
        ...u,
        unread_count: unreadCount,
        latest_message_time: latestTime
      };
    }));

    // Sort active chats to the top
    listWithUnread.sort((a, b) => {
      if (b.latest_message_time !== a.latest_message_time) {
        return b.latest_message_time - a.latest_message_time;
      }
      return a.name.localeCompare(b.name);
    });

    res.json(listWithUnread);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading chats directory.' });
  }
});

// DELETE /api/chat/message/:id
// Delete a specific message
router.delete('/message/:id', verifyToken, async (req, res) => {
  const msgId = parseInt(req.params.id);
  const myId = req.user.id;

  try {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [msgId]);
    if (!msg) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    if (msg.sender_id !== myId && msg.receiver_id !== myId) {
      return res.status(403).json({ message: 'Forbidden. You cannot delete this message.' });
    }

    await db.run('DELETE FROM messages WHERE id = ?', [msgId]);

    // Emit delete event to peer
    if (req.io) {
      req.io.to(`user_${msg.receiver_id}`).emit('chat_message_deleted', { id: msgId, peer_id: msg.sender_id });
      req.io.to(`user_${msg.sender_id}`).emit('chat_message_deleted', { id: msgId, peer_id: msg.receiver_id });
    }

    res.json({ message: 'Message deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting message.' });
  }
});

// DELETE /api/chat/conversation/:peer_id
// Delete/clear entire conversation with a peer
router.delete('/conversation/:peer_id', verifyToken, async (req, res) => {
  const myId = req.user.id;
  let peerId = parseInt(req.params.peer_id);

  try {
    peerId = await getResolvedPeerId(peerId, myId);

    const result = await db.run(
      'DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [myId, peerId, peerId, myId]
    );

    if (req.io) {
      req.io.to(`user_${peerId}`).emit('chat_conversation_cleared', { peer_id: myId });
      req.io.to(`user_${myId}`).emit('chat_conversation_cleared', { peer_id: peerId });
    }

    res.json({ message: `Conversation cleared successfully. Removed ${result.changes} messages.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error clearing conversation.' });
  }
});

module.exports = router;
