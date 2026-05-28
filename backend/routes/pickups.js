const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// POST /api/pickup/request
// Farmer raises a crop pickup request
router.post('/request', verifyToken, checkRole(['farmer']), async (req, res) => {
  const { crop_name, estimated_quantity, address, pickup_date, time_slot } = req.body;

  if (!crop_name || !estimated_quantity || !pickup_date || !time_slot) {
    return res.status(400).json({ message: 'Crop Name, Quantity, Date, and Time Slot are required.' });
  }

  try {
    const result = await db.run(
      `INSERT INTO pickup_requests (farmer_id, crop_name, estimated_quantity, address, pickup_date, time_slot, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, crop_name, estimated_quantity, address || '', pickup_date, time_slot]
    );

    const requestId = result.lastID;

    // Send notification to Admin room
    if (req.io) {
      req.io.to('admin').emit('new_pickup_request', {
        id: requestId,
        farmer_name: req.user.name,
        crop_name,
        estimated_quantity,
        pickup_date
      });
    }

    res.status(201).json({ message: 'Pickup request booked successfully! Awaiting review.', requestId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error booking pickup request.' });
  }
});

// GET /api/pickup/my
// Farmer views their own pickup requests
router.get('/my', verifyToken, checkRole(['farmer']), async (req, res) => {
  try {
    const requests = await db.all(
      `SELECT pr.*, 
              emp.name as employee_name, emp.phone as employee_phone,
              wrk.name as worker_name, wrk.phone as worker_phone
       FROM pickup_requests pr
       LEFT JOIN users emp ON pr.assigned_employee_id = emp.id
       LEFT JOIN users wrk ON pr.assigned_worker_id = wrk.id
       WHERE pr.farmer_id = ?
       ORDER BY pr.created_at DESC`,
      [req.user.id]
    );
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving your pickup requests.' });
  }
});

// GET /api/pickup/list
// Admin / Employee views all pickup requests
router.get('/list', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  try {
    const requests = await db.all(
      `SELECT pr.*, f.name as farmer_name, f.phone as farmer_phone, f.village as farmer_village,
              emp.name as employee_name, wrk.name as worker_name
       FROM pickup_requests pr
       LEFT JOIN users f ON pr.farmer_id = f.id
       LEFT JOIN users emp ON pr.assigned_employee_id = emp.id
       LEFT JOIN users wrk ON pr.assigned_worker_id = wrk.id
       ORDER BY pr.created_at DESC`
    );
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving pickup list.' });
  }
});

// PATCH /api/pickup/:id/assign
// Admin / Employee assigns field staff (employee/worker) and updates status
router.patch('/:id/assign', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  const { assigned_employee_id, assigned_worker_id, admin_note, status } = req.body;
  const requestId = req.params.id;

  try {
    // Validate request exists
    const request = await db.get('SELECT * FROM pickup_requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json({ message: 'Pickup request not found.' });
    }

    const nextStatus = status || 'assigned';

    await db.run(
      `UPDATE pickup_requests 
       SET assigned_employee_id = ?, assigned_worker_id = ?, admin_note = ?, status = ?
       WHERE id = ?`,
      [assigned_employee_id || null, assigned_worker_id || null, admin_note || '', nextStatus, requestId]
    );

    // Get updated details for notifications
    const farmerId = request.farmer_id;
    const farmer = await db.get('SELECT name FROM users WHERE id = ?', [farmerId]);
    const farmerName = farmer ? farmer.name : 'Unknown Farmer';
    
    // Create notifications for Farmer
    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Pickup Request Update 🚜', ?)`,
      [farmerId, `Your pickup request for ${request.crop_name} is now ${nextStatus}. Staff assigned.`]
    );

    // Create notification for assigned Worker (if updated)
    if (assigned_worker_id) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, 'New Task Assigned 📋', ?)`,
        [assigned_worker_id, `You have been assigned a pickup task at Gokulpur for farmer ${farmerName}.`]
      );

      // Create a Task automatically for the worker
      await db.run(
        `INSERT INTO tasks (assigned_to, assigned_by, title, description, status, due_date) VALUES (?, ?, ?, ?, 'pending', ?)`,
        [
          assigned_worker_id, 
          req.user.id, 
          `Crop Pickup: ${request.crop_name}`, 
          `Go to Gokulpur village and collect estimated ${request.estimated_quantity} quintals from ${farmerName}. Address: ${request.address}`,
          request.pickup_date
        ]
      );
    }

    // Push socket alerts
    if (req.io) {
      req.io.to(`user_${farmerId}`).emit('notification_received', { title: 'Pickup Request Update', status: nextStatus });
      if (assigned_worker_id) {
        req.io.to(`user_${assigned_worker_id}`).emit('notification_received', { title: 'New Task Assigned' });
      }
    }

    res.json({ message: 'Pickup request successfully assigned.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error assigning pickup request.' });
  }
});

// DELETE /api/pickup/:id
// Farmer cancels their own crop pickup request if it is not yet completed/assigned
router.delete('/:id', verifyToken, checkRole(['farmer']), async (req, res) => {
  const requestId = req.params.id;

  try {
    // 1. Check if the request exists and belongs to the authenticated farmer
    const request = await db.get(
      'SELECT id, status, farmer_id, crop_name FROM pickup_requests WHERE id = ?', 
      [requestId]
    );

    if (!request) {
      return res.status(404).json({ message: 'Pickup request not found.' });
    }

    if (request.farmer_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden. You do not own this pickup request.' });
    }

    // 2. A farmer can cancel their booking only if it is NOT already picked-up or assigned
    // i.e., status must be 'pending'. If it is 'assigned', 'completed', or anything else, cancel is denied.
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot cancel pickup request. It is already: "${request.status}".` 
      });
    }

    // 3. Delete the request
    await db.run('DELETE FROM pickup_requests WHERE id = ?', [requestId]);

    // Send real-time socket alert to Admin if needed
    if (req.io) {
      req.io.to('admin').emit('pickup_cancelled', { id: requestId, crop_name: request.crop_name });
    }

    res.json({ message: 'Pickup request cancelled successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error cancelling pickup request.' });
  }
});

module.exports = router;
