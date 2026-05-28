const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// GET /api/tasks/my
// Get tasks assigned to the current user (worker/employee)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const tasks = await db.all(
      `SELECT t.*, u.name as assigned_by_name 
       FROM tasks t
       LEFT JOIN users u ON t.assigned_by = u.id
       WHERE t.assigned_to = ?
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving tasks.' });
  }
});

// PATCH /api/tasks/:id/status
// Update a task's status (pending, in_progress, done)
router.patch('/:id/status', verifyToken, async (req, res) => {
  const { status } = req.body;
  const taskId = req.params.id;

  if (!status || !['pending', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status update.' });
  }

  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Workers can only update their own tasks
    if (req.user.role === 'worker' && task.assigned_to !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only update your own tasks.' });
    }

    await db.run(
      `UPDATE tasks SET status = ? WHERE id = ?`,
      [status, taskId]
    );

    // Notify assignee creator (Employee/Admin)
    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Task Status Update ✅', ?)`,
      [task.assigned_by, `Worker ${req.user.name} marked task "${task.title}" as ${status}.`]
    );

    if (req.io) {
      req.io.to(`user_${task.assigned_by}`).emit('notification_received', { title: 'Task Updated' });
    }

    res.json({ message: `Task status updated to ${status}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating task.' });
  }
});

// POST /api/tasks
// Admin/Employee: Assign task to worker/employee
router.post('/', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  const { assigned_to, title, description, due_date } = req.body;

  if (!assigned_to || !title || !due_date) {
    return res.status(400).json({ message: 'Assigned user, title, and due date are required.' });
  }

  try {
    const result = await db.run(
      `INSERT INTO tasks (assigned_to, assigned_by, title, description, status, due_date) VALUES (?, ?, ?, ?, 'pending', ?)`,
      [assigned_to, req.user.id, title, description || '', due_date]
    );

    // Notify worker
    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, 'New Task Assigned 📋', ?)`,
      [assigned_to, `You have been assigned: "${title}". Due date: ${due_date}`]
    );

    if (req.io) {
      req.io.to(`user_${assigned_to}`).emit('notification_received', { title: 'New Task Assigned' });
    }

    res.status(201).json({ message: 'Task assigned successfully.', taskId: result.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error assigning task.' });
  }
});

module.exports = router;
