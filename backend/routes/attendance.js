const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// Helper to auto-terminate past un-terminated shifts at 23:59:59 (11:59 PM)
function getLocalDateParts(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`
  };
}

async function autoTerminatePastShifts(userId = null) {
  try {
    const today = getLocalDateParts().date;
    let query = 'SELECT * FROM attendance WHERE date < ? AND check_out IS NULL';
    const params = [today];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    const records = await db.all(query, params);
    
    for (const r of records) {
      const checkInParts = r.check_in.split(':');
      const checkInMinutes = parseInt(checkInParts[0]) * 60 + parseInt(checkInParts[1]);
      const checkOutMinutes = 23 * 60 + 59;
      
      const workingHours = parseFloat(((checkOutMinutes - checkInMinutes) / 60).toFixed(2));
      
      await db.run(
        `UPDATE attendance SET check_out = '23:59:59', working_hours = ? WHERE id = ?`,
        [workingHours > 0 ? workingHours : 0.0, r.id]
      );
      console.log(`[Shift Auto-Terminated] Attendance ID ${r.id} for User ID ${r.user_id} automatically terminated at 23:59:59.`);
    }
  } catch (err) {
    console.error('Error running past shift auto-termination:', err);
  }
}

// POST /api/attendance/mark
// Mark attendance check-in or check-out dynamically
router.post('/mark', verifyToken, checkRole(['worker', 'employee', 'supervisor']), async (req, res) => {
  const userId = req.user.id;
  const { date: today, time: timeNow } = getLocalDateParts();

  try {
    // 0. Auto-terminate prior dates' unclosed shifts first
    await autoTerminatePastShifts(userId);

    // Check if check-in already logged for today
    const attendance = await db.get(
      'SELECT * FROM attendance WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (!attendance) {
      // 1. Check-In
      await db.run(
        `INSERT INTO attendance (user_id, date, status, check_in) VALUES (?, ?, 'present', ?)`,
        [userId, today, timeNow]
      );
      return res.json({
        message: 'Checked-in successfully!',
        checkInTime: timeNow,
        status: 'present',
        isCheckOut: false
      });
    } else if (attendance.check_out) {
      return res.status(400).json({ message: 'Attendance already completed (checked-out) for today.' });
    } else {
      // 2. Check-Out & working hours calculation
      const checkInParts = attendance.check_in.split(':');
      const checkOutParts = timeNow.split(':');
      
      const checkInMinutes = parseInt(checkInParts[0]) * 60 + parseInt(checkInParts[1]);
      const checkOutMinutes = parseInt(checkOutParts[0]) * 60 + parseInt(checkOutParts[1]);
      
      const workingHours = parseFloat(((checkOutMinutes - checkInMinutes) / 60).toFixed(2));

      await db.run(
        `UPDATE attendance SET check_out = ?, working_hours = ? WHERE id = ?`,
        [timeNow, workingHours, attendance.id]
      );

      return res.json({
        message: 'Checked-out successfully!',
        checkOutTime: timeNow,
        workingHours,
        isCheckOut: true
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error marking attendance.' });
  }
});

// GET /api/attendance/history
// Get attendance history for the logged-in worker/employee
router.get('/history', verifyToken, async (req, res) => {
  try {
    await autoTerminatePastShifts(req.user.id);
    const history = await db.all(
      `SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC`,
      [req.user.id]
    );
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving attendance history.' });
  }
});

// GET /api/attendance/all
// Admin only: Get all worker and employee attendance logs
router.get('/all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    await autoTerminatePastShifts();
    const logs = await db.all(
      `SELECT a.*, u.name, u.role, u.phone 
       FROM attendance a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.date DESC, a.check_in DESC`
    );
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving all attendance.' });
  }
});

module.exports = router;
