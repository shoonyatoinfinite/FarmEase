// Direct slips enabled
const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// POST /api/procurements
// Create a new procurement receipt slip, auto-calculate weights, payouts, and update inventory/ledgers.
router.post('/', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  const {
    pickup_request_id,
    farmer_id,
    farmer_name,
    farmer_phone,
    farmer_village,
    crop_name,
    quintals,
    rate_per_quintal,
    bag_count,
    deductions,
    weight_image,
    costs // array: [{ cost_type, amount, note }]
  } = req.body;

  const hasFarmerId = !!farmer_id;
  const hasDirectFarmer = !!(farmer_name && farmer_phone && farmer_village);

  if ((!hasFarmerId && !hasDirectFarmer) || !crop_name || quintals === undefined || bag_count === undefined || !rate_per_quintal) {
    return res.status(400).json({ message: 'Missing required weight, pricing, or farmer variables.' });
  }

  try {
    // Resolve or Auto-register Farmer if farmer_id is not specified
    let resolvedFarmerId = farmer_id ? parseInt(farmer_id) : null;
    if (!resolvedFarmerId) {
      const existingFarmer = await db.get('SELECT id FROM users WHERE phone = ?', [farmer_phone]);
      if (existingFarmer) {
        resolvedFarmerId = existingFarmer.id;
      } else {
        const bcrypt = require('bcryptjs');
        const hashedFarmerPassword = bcrypt.hashSync('farmer123', 8);
        const newUserResult = await db.run(
          `INSERT INTO users (name, phone, role, password, pin, village, is_active, pay_rate, working_hours, language)
           VALUES (?, ?, 'farmer', ?, '111111', ?, TRUE, 0.0, 0.0, 'hindi')`,
          [farmer_name, farmer_phone, hashedFarmerPassword, farmer_village]
        );
        resolvedFarmerId = newUserResult.lastID;

        // Create standard placeholder farm for them
        await db.run(
          `INSERT INTO farms (farmer_id, area_acres, soil_type) VALUES (?, 1.0, 'Alluvial')`,
          [resolvedFarmerId]
        );
      }
    }

    // 1. Calculations
    const finalQuintals = parseFloat(quintals);
    const finalDeductions = parseFloat(deductions || 0.0);
    const totalPayout = (finalQuintals * parseFloat(rate_per_quintal)) - finalDeductions;

    if (finalQuintals <= 0) {
      return res.status(400).json({ message: 'Invalid weight calculation. Quintals must be positive.' });
    }

    // 2. Generate unique Slip ID
    const year = new Date().getFullYear();
    const countRecord = await db.get('SELECT COUNT(*) as count FROM procurements');
    const slipNumber = String(countRecord.count + 1).padStart(4, '0');
    const slipId = `SLIP-${year}-${slipNumber}`;

    // 3. Save Procurement Slip
    const procResult = await db.run(
      `INSERT INTO procurements (slip_id, pickup_request_id, farmer_id, crop_name, quintals, rate_per_quintal, bag_count, deductions, total_payout, weight_image, weighed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slipId,
        pickup_request_id || null,
        resolvedFarmerId,
        crop_name,
        finalQuintals,
        parseFloat(rate_per_quintal),
        parseInt(bag_count),
        finalDeductions,
        totalPayout,
        weight_image || null,
        req.user.id
      ]
    );

    const procurementId = procResult.lastID;

    // 4. Update Pickup Request status if exists
    if (pickup_request_id) {
      await db.run(
        `UPDATE pickup_requests SET status = 'completed' WHERE id = ?`,
        [pickup_request_id]
      );
    }

    // 5. Add Procurement Costs
    let totalOtherCosts = 0;
    if (costs && Array.isArray(costs)) {
      for (const cost of costs) {
        if (cost.amount > 0) {
          totalOtherCosts += parseFloat(cost.amount);
          await db.run(
            `INSERT INTO procurement_costs (procurement_id, cost_type, amount, note) VALUES (?, ?, ?, ?)`,
            [procurementId, cost.cost_type, cost.amount, cost.note || '']
          );
        }
      }
    }

    // 6. Record Initial Payment as fully Due (unpaid until admin processes payment)
    await db.run(
      `INSERT INTO farmer_payments (farmer_id, procurement_id, total_amount, paid_amount, due_amount, payment_mode, payment_date) 
       VALUES (?, ?, ?, 0.0, ?, 'cash', CURRENT_DATE)`,
      [resolvedFarmerId, procurementId, totalPayout, totalPayout]
    );

    // Also record in dues_advances table
    await db.run(
      `INSERT INTO dues_advances (user_id, type, amount, reason, status) VALUES (?, 'due', ?, ?, 'pending')`,
      [resolvedFarmerId, totalPayout, `Procurement slip ${slipId} balance`]
    );

    // 7. Update Inventory stock levels
    const currentStockRecord = await db.get(
      'SELECT id, current_stock FROM inventory WHERE crop_name = ?',
      [crop_name]
    );

    if (currentStockRecord) {
      // Update stock with the full finalQuintals weight
      await db.run(
        `UPDATE inventory SET current_stock = current_stock + ? WHERE id = ?`,
        [finalQuintals, currentStockRecord.id]
      );
    } else {
      // Create new warehouse stock slot with the full finalQuintals weight
      await db.run(
        `INSERT INTO inventory (crop_name, current_stock, warehouse_location) VALUES (?, ?, 'Warehouse Main-A')`,
        [crop_name, finalQuintals]
      );
    }

    // 8. Log inside Profit Ledger (cost side: payout + extra costs)
    const totalCost = totalPayout + totalOtherCosts;
    await db.run(
      `INSERT INTO profit_ledger (procurement_id, sale_id, total_cost, total_sale, profit) VALUES (?, NULL, ?, 0.0, ?)`,
      [procurementId, totalCost, -totalCost]
    );

    // 9. Notifications & Simulated SMS
    const farmer = await db.get('SELECT name, phone FROM users WHERE id = ?', [resolvedFarmerId]);
    const smsMessage = `🌾 FarmEase Receipt: Slip ${slipId}. Crop: ${crop_name}. Qty: ${finalQuintals.toFixed(2)} Qtl. Rate: ₹${rate_per_quintal}/Qtl. Deductions: ₹${finalDeductions.toFixed(2)}. Payout: ₹${totalPayout.toFixed(2)}. Net payable balance: ₹${totalPayout.toFixed(2)} logged as due. Thank you!`;
    
    console.log(`[SIMULATED Twilio SMS SENT TO ${farmer.phone}]: ${smsMessage}`);

    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Procurement Slip Generated 📄', ?)`,
      [resolvedFarmerId, `Slip ${slipId} for ${crop_name} weighing ${finalQuintals.toFixed(2)} quintals has been logged. Deductions of ₹${finalDeductions.toFixed(2)} applied. Total payout of ₹${totalPayout.toFixed(2)} is generated.`]
    );

    if (req.io) {
      req.io.to(`user_${resolvedFarmerId}`).emit('notification_received', { title: 'New Receipt Generated', slipId });
    }

    res.status(201).json({
      message: 'Procurement processed successfully, slip generated, and SMS simulated!',
      slipId,
      finalNetWeight: finalQuintals * 100,
      finalNetQuintals: finalQuintals,
      totalPayout: totalPayout
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating procurement record.' });
  }
});

// GET /api/procurements
// Get all procurement records (history)
router.get('/', verifyToken, checkRole(['admin', 'employee', 'farmer']), async (req, res) => {
  try {
    let query = `
      SELECT p.*, f.name as farmer_name, f.phone as farmer_phone, f.village as farmer_village,
             w.name as weighed_by_name
      FROM procurements p
      LEFT JOIN users f ON p.farmer_id = f.id
      LEFT JOIN users w ON p.weighed_by = w.id
    `;
    const params = [];

    // Farmers can only see their own procurements
    if (req.user.role === 'farmer') {
      query += ` WHERE p.farmer_id = ? `;
      params.push(req.user.id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const list = await db.all(query, params);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving procurements.' });
  }
});

// POST /api/procurements/:id/propose-edit
// Admin: Propose edits to a slip (requires farmer approval before active application)
router.post('/:id/propose-edit', verifyToken, checkRole(['admin']), async (req, res) => {
  const procurementId = parseInt(req.params.id);
  const { quintals, rate_per_quintal, bag_count, deductions } = req.body;

  if (isNaN(procurementId)) {
    return res.status(400).json({ message: 'Invalid procurement ID.' });
  }

  if (quintals === undefined || rate_per_quintal === undefined || bag_count === undefined) {
    return res.status(400).json({ message: 'Missing required edit parameters.' });
  }

  try {
    const procurement = await db.get('SELECT * FROM procurements WHERE id = ?', [procurementId]);
    if (!procurement) {
      return res.status(404).json({ message: 'Procurement slip not found.' });
    }

    const proposedQuintals = parseFloat(quintals);
    const proposedDeductions = parseFloat(deductions !== undefined && deductions !== null ? deductions : 0.0);
    const proposedRate = parseFloat(rate_per_quintal);
    const proposedBags = parseInt(bag_count);

    if (isNaN(proposedQuintals) || isNaN(proposedRate) || isNaN(proposedBags) || isNaN(proposedDeductions)) {
      return res.status(400).json({ message: 'Invalid numeric parameters provided for slip edit proposal.' });
    }

    const proposedPayout = (proposedQuintals * proposedRate) - proposedDeductions;

    const pendingEditJson = JSON.stringify({
      quintals: proposedQuintals,
      rate_per_quintal: proposedRate,
      bag_count: proposedBags,
      deductions: proposedDeductions,
      total_payout: proposedPayout
    });

    await db.run(
      `UPDATE procurements 
       SET edit_status = 'pending_farmer_approval', pending_edit_json = ? 
       WHERE id = ?`,
      [pendingEditJson, procurementId]
    );

    // Send notification to farmer
    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Slip Edit Proposed 📝', ?)`,
      [
        procurement.farmer_id,
        `Admin has proposed changes to Weighing Slip ${procurement.slip_id}. Proposed Weight: ${proposedQuintals} Qtl (Original: ${procurement.quintals} Qtl), Proposed Rate: ₹${proposedRate}/Qtl (Original: ₹${procurement.rate_per_quintal}/Qtl). Please approve or reject.`
      ]
    );

    res.json({ message: 'Edit proposed successfully! Waiting for farmer approval.', edit_status: 'pending_farmer_approval' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error proposing edits.' });
  }
});

// POST /api/procurements/:id/respond-edit
// Farmer: Approve or reject proposed edits to a weighing slip
router.post('/:id/respond-edit', verifyToken, async (req, res) => {
  const procurementId = parseInt(req.params.id);
  const { response } = req.body; // 'approve' or 'reject'

  if (isNaN(procurementId)) {
    return res.status(400).json({ message: 'Invalid procurement ID.' });
  }

  if (!response || (response !== 'approve' && response !== 'reject')) {
    return res.status(400).json({ message: 'Invalid response. Must be either "approve" or "reject".' });
  }

  try {
    const procurement = await db.get('SELECT * FROM procurements WHERE id = ?', [procurementId]);
    if (!procurement) {
      return res.status(404).json({ message: 'Procurement slip not found.' });
    }

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && (req.user.role !== 'farmer' || req.user.id !== procurement.farmer_id)) {
      return res.status(403).json({ message: 'Only the respective farmer or admin can approve or reject these edits.' });
    }

    if (procurement.edit_status !== 'pending_farmer_approval' || !procurement.pending_edit_json) {
      return res.status(400).json({ message: 'No pending edit request found for this slip.' });
    }

    if (response === 'reject') {
      await db.run(
        `UPDATE procurements SET edit_status = 'rejected', pending_edit_json = NULL WHERE id = ?`,
        [procurementId]
      );

      if (isAdmin) {
        await db.run(
          `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Proposed Edits Cancelled ❌', ?)`,
          [procurement.farmer_id, `Proposed corrections for weighing Slip ${procurement.slip_id} have been cancelled by admin.`]
        );
      } else {
        // Notify admin
        const admin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        if (admin) {
          await db.run(
            `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Proposed Edit Rejected ❌', ?)`,
            [admin.id, `Farmer ${req.user.name} has rejected proposed edits to Slip ${procurement.slip_id}.`]
          );
        }
      }

      return res.json({ message: 'Proposed edits rejected successfully.' });
    }

    // Response is 'approve'
    const edits = JSON.parse(procurement.pending_edit_json);

    // Apply edits to procurement
    await db.run(
      `UPDATE procurements 
       SET quintals = ?, rate_per_quintal = ?, bag_count = ?, deductions = ?, total_payout = ?, edit_status = 'approved', pending_edit_json = NULL 
       WHERE id = ?`,
      [edits.quintals, edits.rate_per_quintal, edits.bag_count, edits.deductions, edits.total_payout, procurementId]
    );

    // Update corresponding farmer_payments record
    const payment = await db.get('SELECT * FROM farmer_payments WHERE procurement_id = ?', [procurementId]);
    if (payment) {
      const newTotal = edits.total_payout;
      const newDue = Math.max(0, newTotal - payment.paid_amount);
      await db.run(
        `UPDATE farmer_payments SET total_amount = ?, due_amount = ? WHERE id = ?`,
        [newTotal, newDue, payment.id]
      );

      // Update dues/advances table
      await db.run(
        `UPDATE dues_advances SET amount = ? 
         WHERE user_id = ? AND type = 'due' AND reason LIKE ? AND status = 'pending'`,
         [newDue, procurement.farmer_id, `%${procurement.slip_id}%`]
      );
    }

    if (isAdmin) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Proposed Edits Force Approved! ✅', ?)`,
        [procurement.farmer_id, `Proposed corrections for weighing Slip ${procurement.slip_id} have been force-approved and applied by admin.`]
      );
    } else {
      // Notify admin
      const admin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (admin) {
        await db.run(
          `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Proposed Edit Approved! ✅', ?)`,
          [admin.id, `Farmer ${req.user.name} approved proposed edits to Slip ${procurement.slip_id}. Edits have been successfully applied.`]
        );
      }
    }

    res.json({ message: 'Proposed edits approved and applied successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error responding to proposed edits.' });
  }
});

module.exports = router;
