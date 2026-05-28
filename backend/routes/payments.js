const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

async function getInstallmentReceipts(procurementId) {
  return db.all(
    `SELECT pr.*, admin.name as issued_by_name
     FROM payment_receipts pr
     LEFT JOIN users admin ON pr.issued_by = admin.id
     WHERE pr.procurement_id = ?
       AND COALESCE(pr.receipt_type, 'installment') = 'installment'
     ORDER BY pr.created_at ASC, pr.id ASC`,
    [procurementId]
  );
}

async function buildPaymentBreakdown(procurementId) {
  const installments = await getInstallmentReceipts(procurementId);
  const byMode = await db.all(
    `SELECT payment_mode, SUM(amount_paid) as total, COUNT(*) as count
     FROM payment_receipts
     WHERE procurement_id = ?
       AND COALESCE(receipt_type, 'installment') = 'installment'
     GROUP BY payment_mode
     ORDER BY payment_mode ASC`,
    [procurementId]
  );

  return {
    installments,
    byMode: byMode.map((row) => ({
      payment_mode: row.payment_mode,
      total: parseFloat(row.total || 0),
      count: parseInt(row.count || 0, 10)
    }))
  };
}

async function createPaymentReceipt({ farmerId, procurementId, farmerPaymentId, amountPaid, paymentMode, totalAmount, totalPaidAfter, dueAfter, issuedBy }) {
  const year = new Date().getFullYear();
  const countRecord = await db.get(
    `SELECT COUNT(*) as count FROM payment_receipts WHERE COALESCE(receipt_type, 'installment') = 'installment'`
  );
  const receiptNo = `PAY-${year}-${String((countRecord.count || 0) + 1).padStart(5, '0')}`;

  const result = await db.run(
    `INSERT INTO payment_receipts 
      (receipt_no, farmer_id, procurement_id, farmer_payment_id, amount_paid, payment_mode, total_amount, total_paid_after, due_after, issued_by, receipt_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installment')`,
    [receiptNo, farmerId, procurementId, farmerPaymentId, amountPaid, paymentMode, totalAmount, totalPaidAfter, dueAfter, issuedBy]
  );

  return { id: result.lastID, receiptNo };
}

async function createSettlementReceipt({ farmerId, procurementId, farmerPaymentId, totalAmount, issuedBy }) {
  const existing = await db.get(
    `SELECT * FROM payment_receipts WHERE procurement_id = ? AND receipt_type = 'settlement'`,
    [procurementId]
  );
  if (existing) {
    return { id: existing.id, receiptNo: existing.receipt_no, existing: true };
  }

  const breakdown = await buildPaymentBreakdown(procurementId);
  const year = new Date().getFullYear();
  const countRecord = await db.get(
    `SELECT COUNT(*) as count FROM payment_receipts WHERE receipt_type = 'settlement'`
  );
  const receiptNo = `SETTLE-${year}-${String((countRecord.count || 0) + 1).padStart(5, '0')}`;

  const result = await db.run(
    `INSERT INTO payment_receipts 
      (receipt_no, farmer_id, procurement_id, farmer_payment_id, amount_paid, payment_mode, total_amount, total_paid_after, due_after, issued_by, receipt_type, payment_breakdown)
     VALUES (?, ?, ?, ?, ?, 'settlement', ?, ?, 0, ?, 'settlement', ?)`,
    [
      receiptNo,
      farmerId,
      procurementId,
      farmerPaymentId,
      totalAmount,
      totalAmount,
      totalAmount,
      issuedBy,
      JSON.stringify(breakdown)
    ]
  );

  return { id: result.lastID, receiptNo, existing: false };
}

async function getProcurementPaymentSummary(procurementId, { createSettlementIfMissing = false, issuedBy = null } = {}) {
  const record = await db.get(
    `SELECT fp.*,
            p.slip_id, p.crop_name, p.quintals, p.created_at as procurement_date,
            u.name as farmer_name, u.phone as farmer_phone, u.village as farmer_village
     FROM farmer_payments fp
     LEFT JOIN procurements p ON fp.procurement_id = p.id
     LEFT JOIN users u ON fp.farmer_id = u.id
     WHERE fp.procurement_id = ?`,
    [procurementId]
  );

  if (!record) {
    return null;
  }

  const isFullyPaid = parseFloat(record.due_amount || 0) <= 0;
  let settlementReceipt = await db.get(
    `SELECT pr.*, admin.name as issued_by_name
     FROM payment_receipts pr
     LEFT JOIN users admin ON pr.issued_by = admin.id
     WHERE pr.procurement_id = ? AND pr.receipt_type = 'settlement'
     ORDER BY pr.created_at DESC, pr.id DESC
     LIMIT 1`,
    [procurementId]
  );

  if (isFullyPaid && !settlementReceipt && createSettlementIfMissing) {
    await createSettlementReceipt({
      farmerId: record.farmer_id,
      procurementId,
      farmerPaymentId: record.id,
      totalAmount: record.total_amount,
      issuedBy: issuedBy || record.farmer_id
    });
    settlementReceipt = await db.get(
      `SELECT pr.*, admin.name as issued_by_name
       FROM payment_receipts pr
       LEFT JOIN users admin ON pr.issued_by = admin.id
       WHERE pr.procurement_id = ? AND pr.receipt_type = 'settlement'
       ORDER BY pr.created_at DESC, pr.id DESC
       LIMIT 1`,
      [procurementId]
    );
  }

  const breakdown = settlementReceipt?.payment_breakdown
    ? JSON.parse(settlementReceipt.payment_breakdown)
    : await buildPaymentBreakdown(procurementId);

  return {
    procurement_id: procurementId,
    slip_id: record.slip_id,
    crop_name: record.crop_name,
    quintals: record.quintals,
    farmer_id: record.farmer_id,
    farmer_name: record.farmer_name,
    farmer_phone: record.farmer_phone,
    farmer_village: record.farmer_village,
    total_amount: record.total_amount,
    paid_amount: record.paid_amount,
    due_amount: record.due_amount,
    isFullyPaid,
    settlementReceipt,
    breakdown
  };
}

function enrichReceiptRow(receipt) {
  if (!receipt) return null;
  const breakdown = receipt.payment_breakdown ? JSON.parse(receipt.payment_breakdown) : null;
  return { ...receipt, breakdown };
}

// GET /api/farmer/receipts
router.get('/receipts', verifyToken, checkRole(['farmer']), async (req, res) => {
  try {
    const receipts = await db.all(
      `SELECT p.*, e.name as weighed_by_name, pay.payment_mode, pay.paid_amount, pay.due_amount
       FROM procurements p
       LEFT JOIN users e ON p.weighed_by = e.id
       LEFT JOIN farmer_payments pay ON pay.procurement_id = p.id
       WHERE p.farmer_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(receipts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving receipts.' });
  }
});

// GET /api/farmer/payments
router.get('/payments', verifyToken, checkRole(['farmer']), async (req, res) => {
  try {
    const summary = await db.get(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as paid_amount,
        COALESCE(SUM(due_amount), 0) as due_amount
       FROM farmer_payments 
       WHERE farmer_id = ?`,
      [req.user.id]
    );
    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving payment summary.' });
  }
});

// GET /api/farmer/transactions
router.get('/transactions', verifyToken, checkRole(['farmer', 'admin']), async (req, res) => {
  try {
    let farmerId = req.user.id;

    if (req.user.role === 'admin' && req.query.farmer_id) {
      farmerId = req.query.farmer_id;
    }

    const transactions = await db.all(
      `SELECT fp.*, p.slip_id, p.crop_name, p.quintals
       FROM farmer_payments fp
       LEFT JOIN procurements p ON fp.procurement_id = p.id
       WHERE fp.farmer_id = ?
       ORDER BY fp.payment_date DESC, fp.id DESC`,
      [farmerId]
    );
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving transactions ledger.' });
  }
});

// GET /api/farmer/payment-receipts/procurement/:procurementId
router.get('/payment-receipts/procurement/:procurementId', verifyToken, async (req, res) => {
  const procurementId = parseInt(req.params.procurementId, 10);
  if (isNaN(procurementId)) {
    return res.status(400).json({ message: 'Invalid procurement ID.' });
  }

  try {
    const paymentRow = await db.get(
      'SELECT farmer_id FROM farmer_payments WHERE procurement_id = ?',
      [procurementId]
    );
    if (!paymentRow) {
      return res.status(404).json({ message: 'Procurement payment record not found.' });
    }

    if (req.user.role === 'farmer' && paymentRow.farmer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const summary = await getProcurementPaymentSummary(procurementId, {
      createSettlementIfMissing: true,
      issuedBy: req.user.id
    });

    if (!summary) {
      return res.status(404).json({ message: 'Procurement payment record not found.' });
    }

    res.json({
      ...summary,
      settlementReceipt: enrichReceiptRow(summary.settlementReceipt)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving procurement payment summary.' });
  }
});

// GET /api/farmer/payment-receipts
router.get('/payment-receipts', verifyToken, checkRole(['farmer']), async (req, res) => {
  try {
    const receipts = await db.all(
      `SELECT pr.*, u.name as farmer_name, u.phone as farmer_phone, u.village as farmer_village,
              p.slip_id, p.crop_name, p.quintals, admin.name as issued_by_name
       FROM payment_receipts pr
       LEFT JOIN users u ON pr.farmer_id = u.id
       LEFT JOIN procurements p ON pr.procurement_id = p.id
       LEFT JOIN users admin ON pr.issued_by = admin.id
       WHERE pr.farmer_id = ?
       ORDER BY pr.created_at DESC, pr.id DESC`,
      [req.user.id]
    );
    res.json(receipts.map(enrichReceiptRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving payment receipts.' });
  }
});

// GET /api/farmer/payment-receipts/all
router.get('/payment-receipts/all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const receipts = await db.all(
      `SELECT pr.*, u.name as farmer_name, u.phone as farmer_phone, u.village as farmer_village,
              p.slip_id, p.crop_name, p.quintals, admin.name as issued_by_name
       FROM payment_receipts pr
       LEFT JOIN users u ON pr.farmer_id = u.id
       LEFT JOIN procurements p ON pr.procurement_id = p.id
       LEFT JOIN users admin ON pr.issued_by = admin.id
       ORDER BY pr.created_at DESC, pr.id DESC`
    );
    res.json(receipts.map(enrichReceiptRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving payment receipts.' });
  }
});

// GET /api/farmer/payments/all
router.get(['/payments/all', '/all'], verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const list = await db.all(
      `SELECT fp.*, u.name as farmer_name, u.phone as farmer_phone, u.village as farmer_village,
              p.slip_id, p.crop_name, p.quintals
       FROM farmer_payments fp
       LEFT JOIN users u ON fp.farmer_id = u.id
       LEFT JOIN procurements p ON fp.procurement_id = p.id
       ORDER BY fp.payment_date DESC, fp.id DESC`
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving all payments.' });
  }
});

// POST /api/farmer/payout
router.post('/payout', verifyToken, checkRole(['admin']), async (req, res) => {
  const { farmer_id, procurement_id, paid_amount, payment_mode } = req.body;

  if (!farmer_id || !procurement_id || !paid_amount || !payment_mode) {
    return res.status(400).json({ message: 'Missing payment details.' });
  }

  const farmerId = parseInt(farmer_id, 10);
  const procurementId = parseInt(procurement_id, 10);
  const paidAmount = parseFloat(paid_amount);

  if (isNaN(farmerId) || isNaN(procurementId) || isNaN(paidAmount) || paidAmount <= 0) {
    return res.status(400).json({ message: 'Invalid payment details provided.' });
  }

  try {
    const payment = await db.get(
      'SELECT * FROM farmer_payments WHERE farmer_id = ? AND procurement_id = ?',
      [farmerId, procurementId]
    );

    if (!payment) {
      return res.status(404).json({ message: 'Procurement payment record not found.' });
    }

    const currentDue = payment.due_amount;
    if (paidAmount > currentDue) {
      return res.status(400).json({ message: `Paid amount cannot exceed current outstanding due of ₹${currentDue}.` });
    }

    const nextPaid = payment.paid_amount + paidAmount;
    const nextDue = currentDue - paidAmount;

    await db.run(
      `UPDATE farmer_payments 
       SET paid_amount = ?, due_amount = ?, payment_mode = ?, payment_date = CURRENT_DATE 
       WHERE id = ?`,
      [nextPaid, nextDue, payment_mode, payment.id]
    );

    const receipt = await createPaymentReceipt({
      farmerId,
      procurementId,
      farmerPaymentId: payment.id,
      amountPaid: paidAmount,
      paymentMode: payment_mode,
      totalAmount: payment.total_amount,
      totalPaidAfter: nextPaid,
      dueAfter: nextDue,
      issuedBy: req.user.id
    });

    let settlementReceipt = null;
    if (nextDue <= 0) {
      settlementReceipt = await createSettlementReceipt({
        farmerId,
        procurementId,
        farmerPaymentId: payment.id,
        totalAmount: payment.total_amount,
        issuedBy: req.user.id
      });

      await db.run(
        `UPDATE dues_advances SET status = 'cleared' 
         WHERE user_id = ? AND type = 'due' AND (reason LIKE '%Procurement slip%' OR reason LIKE '%procurement%')`,
        [farmerId]
      );
    } else {
      await db.run(
        `UPDATE dues_advances SET amount = ? 
         WHERE user_id = ? AND type = 'due' AND (reason LIKE '%Procurement slip%' OR reason LIKE '%procurement%') AND status = 'pending'`,
        [nextDue, farmerId]
      );
    }

    const procurement = await db.get('SELECT slip_id, crop_name FROM procurements WHERE id = ?', [procurementId]);
    const cropName = procurement ? procurement.crop_name : 'Crop';
    const slipId = procurement ? procurement.slip_id : 'SLIP';

    const notificationMessage = nextDue <= 0
      ? `Full payment of INR ${payment.total_amount.toFixed(2)} completed for ${cropName} (Slip ${slipId}). Settlement receipt ${settlementReceipt.receiptNo} is now available in your ledger.`
      : `INR ${paidAmount.toFixed(2)} has been paid via ${payment_mode.toUpperCase()} for ${cropName} (Slip ${slipId}). Remaining due: ₹${nextDue.toFixed(2)}`;

    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [
        farmerId,
        nextDue <= 0 ? 'Full Payment Completed ✅' : 'Payment Cleared ✅',
        notificationMessage
      ]
    );

    if (req.io) {
      req.io.to(`user_${farmerId}`).emit('notification_received', {
        title: nextDue <= 0 ? 'Full Payment Completed' : 'Payment Received',
        amount: nextDue <= 0 ? payment.total_amount : paidAmount
      });
    }

    const summary = await getProcurementPaymentSummary(procurementId);

    res.json({
      message: nextDue <= 0 ? 'Full payout completed successfully!' : 'Payout processed successfully!',
      receiptNo: receipt.receiptNo,
      settlementReceiptNo: settlementReceipt?.receiptNo || null,
      newPaidAmount: nextPaid,
      newDueAmount: nextDue,
      isFullyPaid: nextDue <= 0,
      paymentSummary: summary
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error processing payout.' });
  }
});

router.get('/dues-advances/all', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const list = await db.all(
      `SELECT da.*, u.name as user_name, u.phone as user_phone, u.role as user_role, u.village as user_village
       FROM dues_advances da
       LEFT JOIN users u ON da.user_id = u.id
       ORDER BY da.created_at DESC, da.id DESC`
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving general dues and advances.' });
  }
});

router.get('/dues-advances/my', verifyToken, async (req, res) => {
  try {
    const list = await db.all(
      `SELECT * FROM dues_advances 
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving your dues and advances.' });
  }
});

router.post('/dues-advances', verifyToken, checkRole(['admin']), async (req, res) => {
  const { user_id, type, amount, reason } = req.body;

  if (!user_id || !type || !amount || !reason) {
    return res.status(400).json({ message: 'Missing user_id, type, amount, or reason.' });
  }

  const userId = parseInt(user_id, 10);
  const amt = parseFloat(amount);

  if (isNaN(userId) || isNaN(amt) || amt <= 0) {
    return res.status(400).json({ message: 'Invalid user ID or amount.' });
  }

  if (type !== 'due' && type !== 'advance') {
    return res.status(400).json({ message: 'Type must be either "due" or "advance".' });
  }

  try {
    const user = await db.get('SELECT name, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    await db.run(
      `INSERT INTO dues_advances (user_id, type, amount, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, type, amt, reason]
    );

    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [userId, `New ${type === 'due' ? 'Due' : 'Advance'} Logged 💰`, `Mandi admin logged a pending ${type} of ₹${amt.toFixed(2)} for: "${reason}".`]
    );

    if (req.io) {
      req.io.to(`user_${userId}`).emit('notification_received', { title: `New ${type} assigned`, amount: amt });
    }

    res.status(201).json({ message: 'Due/Advance successfully logged!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error saving due/advance.' });
  }
});

router.post('/dues-advances/:id/clear', verifyToken, checkRole(['admin']), async (req, res) => {
  const dueId = parseInt(req.params.id, 10);

  if (isNaN(dueId)) {
    return res.status(400).json({ message: 'Invalid Due/Advance ID.' });
  }

  try {
    const entry = await db.get('SELECT * FROM dues_advances WHERE id = ?', [dueId]);
    if (!entry) {
      return res.status(404).json({ message: 'Due/Advance record not found.' });
    }

    await db.run(`UPDATE dues_advances SET status = 'cleared' WHERE id = ?`, [dueId]);

    await db.run(
      `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
      [entry.user_id, `${entry.type === 'due' ? 'Due Cleared' : 'Advance Repaid'} ✅`, `Your ${entry.type} of ₹${entry.amount.toFixed(2)} ("${entry.reason}") has been marked as fully cleared.`]
    );

    if (req.io) {
      req.io.to(`user_${entry.user_id}`).emit('notification_received', { title: 'Dues Cleared', amount: entry.amount });
    }

    res.json({ message: 'Due/Advance successfully marked as cleared!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error clearing due/advance.' });
  }
});

module.exports = router;
