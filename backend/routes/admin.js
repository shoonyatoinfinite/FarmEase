const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

// Helper to format/validate Indian vehicle registration numbers (State-RTO-Series-Number)
function formatIndianVehicleNumber(raw) {
  if (!raw) return '';
  // Convert to upper case and remove everything except alphanumeric
  let clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Try to match BH series: e.g. 22BH1234A
  if (/^[0-9]{2}BH/.test(clean)) {
    let result = clean.slice(0, 2);
    let remaining = clean.slice(2);
    if (remaining.startsWith('BH')) {
      result += '-BH';
      remaining = remaining.slice(2);
    } else {
      result += '-' + remaining.slice(0, 2);
      remaining = remaining.slice(2);
    }
    let digits = remaining.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits) {
      result += '-' + digits;
      let alpha = remaining.slice(digits.length).replace(/[^A-Z]/g, '').slice(0, 2);
      if (alpha) {
        result += '-' + alpha;
      }
    }
    return result;
  }

  // Standard Indian Vehicle Number: State-RTO-Series-Number
  let result = '';
  // First 2 letters (State)
  let state = clean.slice(0, 2).replace(/[^A-Z]/g, '');
  if (state) {
    result += state;
    let afterState = clean.slice(state.length);
    
    // RTO digits (leading digits)
    let rtoMatch = afterState.match(/^[0-9]+/);
    let rto = rtoMatch ? rtoMatch[0].slice(0, 2) : '';
    if (rto) {
      // Pad to 2 digits, e.g. MH2 -> MH-02
      let formattedRto = rto.length === 1 ? '0' + rto : rto;
      result += '-' + formattedRto;
      let afterRto = afterState.slice(rto.length);
      
      // Series letters (leading letters)
      let seriesMatch = afterRto.match(/^[A-Z]+/);
      let series = seriesMatch ? seriesMatch[0].slice(0, 3) : '';
      if (series) {
        result += '-' + series;
        let afterSeries = afterRto.slice(series.length);
        
        // Final numbers
        let numMatch = afterSeries.match(/^[0-9]+/);
        let num = numMatch ? numMatch[0].slice(0, 4) : '';
        if (num) {
          let formattedNum = num;
          while (formattedNum.length < 4) formattedNum = '0' + formattedNum;
          result += '-' + formattedNum;
        }
      } else {
        // If there are digits but no series letters yet, check if there are any digits
        let numMatch = afterRto.match(/^[0-9]+/);
        let num = numMatch ? numMatch[0].slice(0, 4) : '';
        if (num) {
          let formattedNum = num;
          while (formattedNum.length < 4) formattedNum = '0' + formattedNum;
          result += '-' + formattedNum;
        }
      }
    }
  } else {
    result = clean;
  }
  return result;
}


// GET /api/admin/dashboard
// Admin executive summary: Net Profit, Total Procured, Total Sold, Total Expenses
router.get('/dashboard', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    // 1. Procured stats
    const procStats = await db.get(
      `SELECT 
        COALESCE(SUM(quintals), 0) as total_procured_quintals,
        COALESCE(SUM(total_payout), 0) as total_payout
       FROM procurements`
    );

    // 2. Outward sales stats
    const saleStats = await db.get(
      `SELECT 
        COALESCE(SUM(quantity), 0) as total_sold_quintals,
        COALESCE(SUM(total_sale_amount), 0) as total_revenue
       FROM sales`
    );

    // 3. Procurement extra costs (transport, labour, etc.)
    const costStats = await db.get(
      `SELECT COALESCE(SUM(amount), 0) as total_procurement_costs FROM procurement_costs`
    );

    // 4. Vehicle expenses
    const vehicleStats = await db.get(
      `SELECT COALESCE(SUM(fuel_expense), 0) as total_fuel_expenses FROM vehicles`
    );

    // Calculations
    const totalExpenses = procStats.total_payout + costStats.total_procurement_costs + vehicleStats.total_fuel_expenses;
    const netProfit = saleStats.total_revenue - totalExpenses;

    // 5. Active Stock
    const stockStats = await db.get(`SELECT COALESCE(SUM(current_stock), 0) as stock_quintals FROM inventory`);

    // 6. Farmer dues
    const dueStats = await db.get(`SELECT COALESCE(SUM(due_amount), 0) as total_dues FROM farmer_payments`);

    res.json({
      netProfit,
      totalRevenue: saleStats.total_revenue,
      totalExpenses,
      payouts: procStats.total_payout,
      extraProcurementCosts: costStats.total_procurement_costs,
      fuelExpenses: vehicleStats.total_fuel_expenses,
      totalProcuredQuintals: procStats.total_procured_quintals,
      totalSoldQuintals: saleStats.total_sold_quintals,
      stockQuintals: stockStats.stock_quintals,
      farmerOutstandingDues: dueStats.total_dues
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading admin dashboard.' });
  }
});

// GET /api/admin/inventory
// Get active stock in inventory
router.get('/inventory', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  try {
    const stock = await db.all('SELECT * FROM inventory ORDER BY crop_name');
    res.json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading inventory.' });
  }
});

// POST /api/admin/sales
// Log an outward crop sale
router.post('/sales', verifyToken, checkRole(['admin']), async (req, res) => {
  const { crop_name, quantity, buyer_name, sale_price_per_quintal, truck_number } = req.body;

  if (!crop_name || !quantity || !buyer_name || !sale_price_per_quintal) {
    return res.status(400).json({ message: 'Missing required sale parameters.' });
  }

  try {
    // 1. Verify stock is available
    const stock = await db.get(
      'SELECT id, current_stock FROM inventory WHERE crop_name = ?',
      [crop_name]
    );

    if (!stock || stock.current_stock < quantity) {
      return res.status(400).json({
        message: `Insufficient stock for ${crop_name}. Available stock: ${stock ? stock.current_stock : 0} Quintals.`
      });
    }

    // 2. Calculate Revenue
    const totalSaleAmount = quantity * sale_price_per_quintal;

    // 3. Log Outward Sale
    const formattedTruck = truck_number ? formatIndianVehicleNumber(truck_number) : '';
    const saleResult = await db.run(
      `INSERT INTO sales (crop_name, quantity, buyer_name, sale_price_per_quintal, total_sale_amount, truck_number) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crop_name, quantity, buyer_name, sale_price_per_quintal, totalSaleAmount, formattedTruck]
    );

    const saleId = saleResult.lastID;

    // 4. Update Stock
    await db.run(
      `UPDATE inventory SET current_stock = current_stock - ? WHERE id = ?`,
      [quantity, stock.id]
    );

    // 5. Log in Profit Ledger (revenue side)
    // Assume average cost of procurement is rate * qty
    const averageCost = quantity * (sale_price_per_quintal * 0.85); // Simulated average cost basis for profit
    const profit = totalSaleAmount - averageCost;
    await db.run(
      `INSERT INTO profit_ledger (procurement_id, sale_id, total_cost, total_sale, profit) VALUES (NULL, ?, ?, ?, ?)`,
      [saleId, averageCost, totalSaleAmount, profit]
    );

    res.status(201).json({
      message: 'Outward sale successfully logged and stock decremented.',
      saleId,
      totalSaleAmount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error processing outward sale.' });
  }
});

// GET /api/admin/vehicles
// List all vehicles and expenses logs
router.get('/vehicles', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  try {
    const list = await db.all(
      `SELECT v.*, u.name as assigned_to_name, u.phone as assigned_to_phone 
       FROM vehicles v
       LEFT JOIN users u ON v.assigned_to = u.id`
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading vehicles.' });
  }
});

// POST /api/admin/vehicles/expense
// Log vehicle fuel expense
router.post('/vehicles/expense', verifyToken, checkRole(['admin', 'worker', 'employee']), async (req, res) => {
  const { vehicle_id, vehicle_number, fuel_expense } = req.body;

  if (fuel_expense === undefined || isNaN(parseFloat(fuel_expense))) {
    return res.status(400).json({ message: 'Valid fuel expense is required.' });
  }

  try {
    let vehicle = null;

    if (vehicle_id) {
      vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    } else if (vehicle_number) {
      const formattedNumber = formatIndianVehicleNumber(vehicle_number);
      vehicle = await db.get('SELECT * FROM vehicles WHERE LOWER(vehicle_number) = LOWER(?)', [formattedNumber]);
      
      if (!vehicle) {
        // Automatically create new vehicle since it does not exist
        const result = await db.run(
          `INSERT INTO vehicles (vehicle_number, type, assigned_to, fuel_expense, km_driven, last_updated) 
           VALUES (?, ?, NULL, ?, 0.0, CURRENT_DATE)`,
          [formattedNumber, 'Tractor Trolley', parseFloat(fuel_expense)]
        );
        return res.json({ message: 'Vehicle created and fuel logs updated successfully.' });
      }
    }

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found and no vehicle number provided.' });
    }

    await db.run(
      `UPDATE vehicles 
       SET fuel_expense = fuel_expense + ?, last_updated = CURRENT_DATE 
       WHERE id = ?`,
      [parseFloat(fuel_expense), vehicle.id]
    );

    res.json({ message: 'Vehicle logs updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating vehicle logs.' });
  }
});

// POST /api/admin/vehicles
// Admin: Add a new vehicle to the transport fleet
router.post('/vehicles', verifyToken, checkRole(['admin']), async (req, res) => {
  const { vehicle_number, type, assigned_to } = req.body;

  if (!vehicle_number || !type) {
    return res.status(400).json({ message: 'Vehicle number and type are required.' });
  }

  try {
    const formattedNumber = formatIndianVehicleNumber(vehicle_number);
    await db.run(
      `INSERT INTO vehicles (vehicle_number, type, assigned_to, fuel_expense, km_driven, last_updated) 
       VALUES (?, ?, ?, 0.0, 0.0, CURRENT_DATE)`,
      [formattedNumber, type, assigned_to || null]
    );

    res.status(201).json({ message: 'Vehicle successfully added to fleet!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error adding vehicle.' });
  }
});

// PATCH /api/admin/vehicles/:id
// Admin: Edit vehicle details (number, type, or driver assignment)
router.patch('/vehicles/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const vehicleId = req.params.id;
  const { vehicle_number, type, assigned_to, fuel_expense, km_driven } = req.body;

  try {
    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    const nextNumber = vehicle_number !== undefined ? formatIndianVehicleNumber(vehicle_number) : vehicle.vehicle_number;
    const nextType = type !== undefined ? type : vehicle.type;
    const nextAssigned = assigned_to !== undefined ? assigned_to : vehicle.assigned_to;
    const nextFuel = fuel_expense !== undefined ? parseFloat(fuel_expense) : vehicle.fuel_expense;
    const nextKm = km_driven !== undefined ? parseFloat(km_driven) : vehicle.km_driven;

    await db.run(
      `UPDATE vehicles 
       SET vehicle_number = ?, type = ?, assigned_to = ?, fuel_expense = ?, km_driven = ?, last_updated = CURRENT_DATE 
       WHERE id = ?`,
      [nextNumber, nextType, nextAssigned, nextFuel, nextKm, vehicleId]
    );

    res.json({ message: 'Vehicle successfully updated!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating vehicle.' });
  }
});

// DELETE /api/admin/vehicles/:id
// Admin: Delete a vehicle from the fleet
router.delete('/vehicles/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const vehicleId = req.params.id;

  try {
    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    await db.run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
    res.json({ message: 'Vehicle successfully removed from fleet!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting vehicle.' });
  }
});

// GET /api/admin/farmers/list
// Get all registered farmers
router.get('/farmers/list', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  const search = req.query.search || '';
  try {
    const list = await db.all(
      `SELECT id, name, phone, email, village, address, upi_id, is_active, created_at
       FROM users 
       WHERE role = 'farmer' 
         AND (name LIKE ? OR phone LIKE ? OR village LIKE ?)
       ORDER BY name ASC`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading farmers.' });
  }
});

// GET /api/admin/workers/list
// Get all registered workers and their total payouts
router.get('/workers/list', verifyToken, checkRole(['admin', 'employee']), async (req, res) => {
  try {
    const list = await db.all(
      `SELECT u.id, u.name, u.phone, u.role, u.is_active, u.pay_rate, u.working_hours, u.pin, u.email, u.pay_type,
              COALESCE((SELECT SUM(amount) FROM dues_advances WHERE user_id = u.id AND type = 'payout'), 0.0) as total_payouts
       FROM users u
       WHERE u.role = 'worker' OR u.role = 'employee' OR u.role = 'supervisor'
       ORDER BY u.name ASC`
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading staff.' });
  }
});

// POST /api/admin/broadcast
// Send global notification
router.post('/broadcast', verifyToken, checkRole(['admin']), async (req, res) => {
  const { title, message } = req.body;

  if (!title || !message) {
    return res.status(400).json({ message: 'Title and Message are required.' });
  }

  try {
    // Add notification to all active users
    const users = await db.all('SELECT id FROM users WHERE is_active = TRUE');
    for (const u of users) {
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`,
        [u.id, `🚨 BROADCAST: ${title}`, message]
      );
    }

    // Trigger Socket Broadcast
    if (req.io) {
      req.io.emit('new_broadcast', { title, message, sender: req.user.name });
    }

    res.json({ message: 'Global broadcast completed successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error sending broadcast.' });
  }
});

// GET /api/admin/price-trends
// Premium AI pricing suggestions based on recent market and costs
router.get('/price-trends', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    // Collect all active crops and their average buying rate (procurements) vs average selling rate (sales)
    const pricingStats = await db.all(
      `SELECT 
        cp.crop_name,
        COALESCE((SELECT AVG(p.rate_per_quintal) FROM procurements p WHERE p.crop_name = cp.crop_name), MAX(cp.price_per_quintal)) as avg_buy_rate,
        COALESCE((SELECT AVG(s.sale_price_per_quintal) FROM sales s WHERE s.crop_name = cp.crop_name), MAX(cp.price_per_quintal) * 1.15) as avg_sell_rate
       FROM crop_prices cp
       GROUP BY cp.crop_name`
    );

    // Map trends
    const trends = pricingStats.map(stat => {
      const buy = parseFloat(stat.avg_buy_rate);
      const sell = parseFloat(stat.avg_sell_rate) || buy * 1.15; // fallback sell premium of 15%
      const currentMargin = sell - buy;

      // Suggest rate
      let suggestion = buy;
      let reason = 'Keep rate stable. Steady market activity.';

      if (currentMargin > buy * 0.20) {
        suggestion = buy * 1.05; // margin is high, suggest offering farmers 5% more to get more stock!
        reason = `High selling margin detected (₹${currentMargin.toFixed(2)}/Qtl). Suggest increasing buy rate by 5% to boost inventory inflow.`;
      } else if (currentMargin < buy * 0.05) {
        suggestion = buy * 0.95; // margin is very thin, suggest reducing buy rate to maintain profitability
        reason = `Tight selling margins detected (₹${currentMargin.toFixed(2)}/Qtl). Suggest lowering buy rate by 5% to preserve net profits.`;
      }

      return {
        crop_name: stat.crop_name,
        current_buy_rate: buy,
        recent_sell_rate: sell,
        margin: currentMargin,
        ai_suggested_rate: parseFloat(suggestion.toFixed(2)),
        reason
      };
    });

    res.json(trends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading price trends.' });
  }
});

  // POST /api/admin/users
  // Admin: Add a new user (farmer, employee, worker) directly
  router.post('/users', verifyToken, checkRole(['admin']), async (req, res) => {
    const { name, phone, email, password, pin, role, upi_id, address, village, pay_rate, working_hours, pay_type } = req.body;
  
    if (!name || !phone || !role) {
      return res.status(400).json({ message: 'Name, phone number, and role are required.' });
    }
  
    try {
      const existing = await db.get('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existing) {
        return res.status(400).json({ message: 'A user with this phone number already exists.' });
      }
  
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(password || 'farmease123', 8);
  
      await db.run(
        `INSERT INTO users (name, phone, email, password, pin, role, upi_id, address, village, pay_rate, working_hours, pay_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, phone, email || '', hashedPassword, pin || '', role, upi_id || '', address || '', village || '', parseFloat(pay_rate) || 0.0, parseFloat(working_hours) || 0.0, pay_type || 'hourly']
      );

    res.status(201).json({ message: 'User added successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error adding user.' });
  }
});

// PATCH /api/admin/users/:id
// Admin: Edit a user's details (farmers, employees, workers)
router.patch('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const userId = parseInt(req.params.id);
  const { name, phone, email, password, pin, role, upi_id, address, village, pay_rate, working_hours, pay_type, is_active } = req.body;

  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (pin !== undefined) { updates.push('pin = ?'); params.push(pin); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (upi_id !== undefined) { updates.push('upi_id = ?'); params.push(upi_id); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (village !== undefined) { updates.push('village = ?'); params.push(village); }
    if (pay_rate !== undefined) { updates.push('pay_rate = ?'); params.push(parseFloat(pay_rate) || 0.0); }
    if (working_hours !== undefined) { updates.push('working_hours = ?'); params.push(parseFloat(working_hours) || 0.0); }
    if (pay_type !== undefined) { updates.push('pay_type = ?'); params.push(pay_type); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active === true || is_active === 'true' || is_active === 1 || is_active === '1'); }

    if (password) {
      const bcrypt = require('bcryptjs');
      updates.push('password = ?');
      params.push(bcrypt.hashSync(password, 8));
    }

    if (updates.length > 0) {
      params.push(userId);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ message: 'User updated successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating user.' });
  }
});

// POST /api/admin/users/:id/pay
// Admin only: Record a manual payout for a specific staff member
router.post('/users/:id/pay', verifyToken, checkRole(['admin']), async (req, res) => {
  const userId = parseInt(req.params.id);
  const { amount, reason } = req.body;

  if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'A valid numeric amount greater than zero is required.' });
  }

  try {
    const user = await db.get('SELECT name, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const amt = parseFloat(amount);
    const logReason = reason || `Staff payout to ${user.name}`;

    // 1. Log in dues_advances as completed payout
    await db.run(
      `INSERT INTO dues_advances (user_id, type, amount, reason, status) VALUES (?, 'payout', ?, ?, 'completed')`,
      [userId, amt, logReason]
    );

    // 2. Log in procurement_costs as Labor expense so it shows up in profit metrics
    await db.run(
      `INSERT INTO procurement_costs (procurement_id, cost_type, amount, note) VALUES (NULL, 'Labor', ?, ?)`,
      [amt, logReason]
    );

    // 3. Log in profit_ledger
    await db.run(
      `INSERT INTO profit_ledger (procurement_id, sale_id, total_cost, total_sale, profit) VALUES (NULL, NULL, ?, 0.0, ?)`,
      [amt, -amt]
    );

    res.json({ message: `Successfully logged pay of ₹${amt.toLocaleString()} for ${user.name}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error processing staff pay.' });
  }
});

// DELETE /api/admin/users/:id
// Admin: Remove a user (farmer, employee, worker)
router.delete('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete the administrator.' });
    }

    // Clean up references to prevent foreign key constraint violations
    await db.run('DELETE FROM attendance WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM dues_advances WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await db.run('UPDATE pickup_requests SET assigned_employee_id = NULL WHERE assigned_employee_id = ?', [userId]);
    await db.run('UPDATE pickup_requests SET assigned_worker_id = NULL WHERE assigned_worker_id = ?', [userId]);
    await db.run('UPDATE vehicles SET assigned_to = NULL WHERE assigned_to = ?', [userId]);
    await db.run('DELETE FROM tasks WHERE assigned_to = ? OR assigned_by = ?', [userId, userId]);
    await db.run('UPDATE procurements SET weighed_by = NULL WHERE weighed_by = ?', [userId]);
    await db.run('UPDATE crop_prices SET updated_by = NULL WHERE updated_by = ?', [userId]);
    await db.run('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [userId, userId]);
    await db.run('UPDATE payment_receipts SET issued_by = NULL WHERE issued_by = ?', [userId]);

    // Clean up farmer specific references if user is a farmer
    if (user.role === 'farmer') {
      await db.run(
        `UPDATE profit_ledger 
         SET procurement_id = NULL 
         WHERE procurement_id IN (SELECT id FROM procurements WHERE farmer_id = ?)`, 
        [userId]
      );
      await db.run('DELETE FROM payment_receipts WHERE farmer_id = ?', [userId]);
      await db.run('DELETE FROM farmer_payments WHERE farmer_id = ?', [userId]);
      await db.run('DELETE FROM procurements WHERE farmer_id = ?', [userId]);
      await db.run('DELETE FROM pickup_requests WHERE farmer_id = ?', [userId]);
      await db.run('DELETE FROM farms WHERE farmer_id = ?', [userId]);
    }

    // Direct removal
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error removing user.' });
  }
});

// POST /api/admin/inventory
// Admin only: Add a new crop or stock line to the warehouse
router.post('/inventory', verifyToken, checkRole(['admin']), async (req, res) => {
  const { crop_name, current_stock, warehouse_location } = req.body;

  if (!crop_name) {
    return res.status(400).json({ message: 'Crop Name is required.' });
  }

  try {
    // Check if the crop already exists in inventory
    const existing = await db.get(
      'SELECT id FROM inventory WHERE LOWER(crop_name) = LOWER(?)',
      [crop_name]
    );

    if (existing) {
      return res.status(400).json({ message: `Crop "${crop_name}" already exists in the warehouse. You can edit its quantity instead.` });
    }

    await db.run(
      `INSERT INTO inventory (crop_name, current_stock, warehouse_location, last_updated) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [crop_name, parseFloat(current_stock) || 0.0, warehouse_location || 'Warehouse Main']
    );

    res.status(201).json({ message: 'Crop successfully added to warehouse inventory!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error adding crop to inventory.' });
  }
});

// PATCH /api/admin/inventory/:id
// Admin only: Edit crop quantity or location in the warehouse
router.patch('/inventory/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const stockId = req.params.id;
  const { crop_name, current_stock, warehouse_location } = req.body;

  try {
    const item = await db.get('SELECT * FROM inventory WHERE id = ?', [stockId]);
    if (!item) {
      return res.status(404).json({ message: 'Crop stock item not found.' });
    }

    const nextCropName = crop_name !== undefined ? crop_name : item.crop_name;
    const nextStock = current_stock !== undefined ? parseFloat(current_stock) : item.current_stock;
    const nextLocation = warehouse_location !== undefined ? warehouse_location : item.warehouse_location;

    await db.run(
      `UPDATE inventory 
       SET crop_name = ?, current_stock = ?, warehouse_location = ?, last_updated = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nextCropName, nextStock, nextLocation, stockId]
    );

    res.json({ message: 'Crop stock details updated successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating crop stock.' });
  }
});

// DELETE /api/admin/inventory/:id
// Admin only: Delete a crop stock line from the warehouse entirely
router.delete('/inventory/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const stockId = req.params.id;

  try {
    const item = await db.get('SELECT * FROM inventory WHERE id = ?', [stockId]);
    if (!item) {
      return res.status(404).json({ message: 'Crop stock item not found.' });
    }

    await db.run('DELETE FROM inventory WHERE id = ?', [stockId]);
    res.json({ message: 'Crop successfully deleted from the warehouse inventory!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting crop stock.' });
  }
});

// GET /api/admin/costs
// Admin only: Get all general operational expenses
router.get('/costs', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const list = await db.all(
      `SELECT * FROM procurement_costs WHERE procurement_id IS NULL ORDER BY id DESC`
    );
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading operational costs.' });
  }
});

// POST /api/admin/costs
// Admin only: Log a direct general operational expense (Fuel, Labor, Office, Transport, Other)
router.post('/costs', verifyToken, checkRole(['admin']), async (req, res) => {
  const { cost_type, amount, note } = req.body;

  if (!cost_type || amount === undefined || isNaN(parseFloat(amount))) {
    return res.status(400).json({ message: 'Cost type and numeric amount are required.' });
  }

  try {
    const amt = parseFloat(amount);
    await db.run(
      `INSERT INTO procurement_costs (procurement_id, cost_type, amount, note) VALUES (NULL, ?, ?, ?)`,
      [cost_type, amt, note || '']
    );

    // Log in profit ledger as general operational cost (cost side)
    await db.run(
      `INSERT INTO profit_ledger (procurement_id, sale_id, total_cost, total_sale, profit) VALUES (NULL, NULL, ?, 0.0, ?)`,
      [amt, -amt]
    );

    res.status(201).json({ message: 'Operational expense successfully logged!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error logging operational cost.' });
  }
});

// GET /api/admin/attendance
// Admin only: Get all staff attendance logs
router.get('/attendance', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const logs = await db.all(
      `SELECT a.*, u.name as staff_name, u.role as staff_role, u.phone as staff_phone 
       FROM attendance a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.date DESC, a.check_in DESC`
    );
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error retrieving attendance logs.' });
  }
});

// POST /api/admin/attendance/daily-pay
// Admin only: Feed daily pay for a specific attendance record
router.post('/attendance/daily-pay', verifyToken, checkRole(['admin']), async (req, res) => {
  const { attendance_id, daily_pay } = req.body;
  if (!attendance_id || daily_pay === undefined) {
    return res.status(400).json({ message: 'Attendance ID and daily pay are required.' });
  }

  try {
    await db.run(
      'UPDATE attendance SET daily_pay = ? WHERE id = ?',
      [parseFloat(daily_pay) || 0.0, attendance_id]
    );
    res.json({ message: 'Daily pay updated successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating daily pay.' });
  }
});

// POST /api/admin/attendance/manual
// Admin only: Manually log/force attendance & feed daily pay for a staff member
router.post('/attendance/manual', verifyToken, checkRole(['admin']), async (req, res) => {
  const { user_id, date, status, working_hours, daily_pay } = req.body;
  if (!user_id || !date) {
    return res.status(400).json({ message: 'Staff member ID and date are required.' });
  }

  try {
    const existing = await db.get(
      'SELECT id FROM attendance WHERE user_id = ? AND date = ?',
      [user_id, date]
    );

    if (existing) {
      await db.run(
        `UPDATE attendance 
         SET status = ?, working_hours = ?, daily_pay = ?, check_in = COALESCE(check_in, '09:00:00'), check_out = COALESCE(check_out, '18:00:00')
         WHERE id = ?`,
        [status || 'present', parseFloat(working_hours) || 8.0, parseFloat(daily_pay) || 0.0, existing.id]
      );
      res.json({ message: 'Staff daily log updated successfully!' });
    } else {
      await db.run(
        `INSERT INTO attendance (user_id, date, status, check_in, check_out, working_hours, daily_pay) 
         VALUES (?, ?, ?, '09:00:00', '18:00:00', ?, ?)`,
        [user_id, date, status || 'present', parseFloat(working_hours) || 8.0, parseFloat(daily_pay) || 0.0]
      );
      res.json({ message: 'Staff daily log created successfully!' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating manual log.' });
  }
});

// GET /api/admin/forgot-password/list
// Retrieves all password recovery requests (Admin/Supervisor)
router.get('/forgot-password/list', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM forgot_password_requests ORDER BY created_at DESC');
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error loading recovery requests.' });
  }
});

// POST /api/admin/forgot-password/:id/:action
// Approves or Rejects a password recovery request, updates the user credentials
router.post('/forgot-password/:id/:action', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id, action } = req.params;

  try {
    const request = await db.get('SELECT * FROM forgot_password_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is already resolved.' });
    }

    if (action === 'approve') {
      // Find the user by phone number
      const targetUser = await db.get('SELECT id FROM users WHERE phone = ?', [request.phone]);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found in database.' });
      }

      // Hash and update password and PIN
      const hashedPass = bcrypt.hashSync(request.new_password, 8);
      await db.run(
        `UPDATE users SET password = ?, pin = ? WHERE id = ?`,
        [hashedPass, request.new_pin, targetUser.id]
      );

      await db.run(`UPDATE forgot_password_requests SET status = 'approved' WHERE id = ?`, [id]);

      // Notify the target user
      await db.run(
        `INSERT INTO notifications (user_id, title, message) VALUES (?, 'Recovery Approved! Key updated 🔑', 'Your password reset request has been approved. Please log in with your new credentials.')`,
        [targetUser.id]
      );

      res.json({ message: 'Request approved successfully! User credentials updated.' });
    } else {
      await db.run(`UPDATE forgot_password_requests SET status = 'rejected' WHERE id = ?`, [id]);
      res.json({ message: 'Request rejected successfully.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error resolving request.' });
  }
});

// DELETE /api/admin/forgot-password/:id
// Deletes a password recovery request (only if it is resolved: approved or rejected)
router.delete('/forgot-password/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const request = await db.get('SELECT * FROM forgot_password_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    if (request.status === 'pending') {
      return res.status(400).json({ message: 'Cannot delete a pending recovery request.' });
    }
    await db.run('DELETE FROM forgot_password_requests WHERE id = ?', [id]);
    res.json({ message: 'Recovery request deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting recovery request.' });
  }
});

module.exports = router;

