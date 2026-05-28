// PostgreSQL-only data layer (no SQLite/MySQL).
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let dbInstance = null;

// Helper to translate '?' placeholder into postgres '$1, $2, ...' sequential format
function translateSQL(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Database interface wrapper
const db = {
  // Execute a query and return all matching rows
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbInstance.query(translateSQL(sql), params, (err, results) => {
        if (err) reject(err);
        else resolve(results.rows);
      });
    });
  },

  // Execute a query and return a single row
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbInstance.query(translateSQL(sql), params, (err, results) => {
        if (err) reject(err);
        else resolve(results.rows[0] || null);
      });
    });
  },

  // Execute a command (INSERT, UPDATE, DELETE) and return info
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      let modifiedSql = translateSQL(sql);
      const isInsert = modifiedSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !modifiedSql.toUpperCase().includes('RETURNING')) {
        modifiedSql += ' RETURNING id';
      }
      dbInstance.query(modifiedSql, params, (err, results) => {
        if (err) reject(err);
        else {
          const lastID = (results.rows && results.rows[0]) ? results.rows[0].id : null;
          resolve({ lastID, changes: results.rowCount });
        }
      });
    });
  }
};

// Initialize database connection
async function initDB() {
  const { Client, Pool } = require('pg');

  const dbUrl = process.env.DATABASE_URL;
  const pgUser = process.env.DB_USER || 'postgres';
  const pgPassword = process.env.DB_PASSWORD || 'postgres';
  const pgHost = process.env.DB_HOST || 'localhost';
  const pgPort = process.env.DB_PORT || 5432;
  const pgDatabase = process.env.DB_NAME || 'farmease';

  // Determine if this is a local or remote connection to configure SSL automatically
  const isLocal = dbUrl
    ? (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'))
    : (pgHost === 'localhost' || pgHost === '127.0.0.1');

  // SSL is required for remote database providers like Supabase
  const ssl = process.env.DB_SSL === 'true' || (!isLocal && process.env.DB_SSL !== 'false')
    ? { rejectUnauthorized: false }
    : false;

  // Auto-create database if not exists (only for local connections where individual credentials are set)
  if (!dbUrl && isLocal) {
    const adminConnectionString = `postgres://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/postgres`;
    const client = new Client({ connectionString: adminConnectionString, connectionTimeoutMillis: 5000, ssl: ssl });
    try {
      await client.connect();
      const checkDb = await client.query(`SELECT 1 FROM pg_database WHERE datname='${pgDatabase}'`);
      if (checkDb.rowCount === 0) {
        await client.query(`CREATE DATABASE ${pgDatabase}`);
        console.log(`Database "${pgDatabase}" created successfully.`);
      }
      await client.end();
    } catch (err) {
      console.log('⚠️ Postgres database creation check skipped:', err.message);
    }
  }

  console.log('Connecting to PostgreSQL database pool...');
  const poolConfig = dbUrl
    ? { connectionString: dbUrl, connectionTimeoutMillis: 5000, ssl: ssl }
    : {
        host: pgHost,
        port: pgPort,
        user: pgUser,
        password: pgPassword,
        database: pgDatabase,
        connectionTimeoutMillis: 5000,
        ssl: ssl
      };

  dbInstance = new Pool(poolConfig);

  // Perform a dry run test query to verify connection
  await dbInstance.query('SELECT 1');
  console.log('🚀 Connected to PostgreSQL database pool successfully!');

  // Run migrations
  await runMigrations();
  
  // Clear previous entries of payments, receipts, profit ledgers, costs, and slips
  try {
    await db.run('TRUNCATE TABLE payment_receipts, farmer_payments, procurements, profit_ledger, procurement_costs, dues_advances, sales RESTART IDENTITY CASCADE');
    await db.run('UPDATE vehicles SET fuel_expense = 0.0, km_driven = 0.0');
    console.log('✅ Wiped out all previous entries of payments, receipts, and slips successfully.');
  } catch (e) {
    console.log('Skipped entries cleanup:', e.message);
  }

  // Run seeders
  await runSeeders();
}

async function runMigrations() {
  console.log('Running database migrations...');
  
  const autoIncrement = 'SERIAL PRIMARY KEY';
  const booleanType = 'BOOLEAN';
  const textBlobType = 'TEXT';

  const queries = [
    // 1. USERS
    `CREATE TABLE IF NOT EXISTS users (
      id ${autoIncrement},
      name VARCHAR(100),
      phone VARCHAR(15) UNIQUE,
      email VARCHAR(100),
      password VARCHAR(255),
      pin VARCHAR(10),
      role VARCHAR(50),
      upi_id VARCHAR(100),
      address TEXT,
      village VARCHAR(100),
      profile_photo VARCHAR(255),
      language VARCHAR(50) DEFAULT 'hindi',
      is_active ${booleanType} DEFAULT TRUE,
      pay_rate FLOAT DEFAULT 0.0,
      working_hours FLOAT DEFAULT 0.0,
      pay_type VARCHAR(20) DEFAULT 'hourly',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. FARMS
    `CREATE TABLE IF NOT EXISTS farms (
      id ${autoIncrement},
      farmer_id INT,
      location_lat DECIMAL(10,8),
      location_lng DECIMAL(11,8),
      area_acres FLOAT,
      soil_type VARCHAR(50),
      FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // 3. CROP PRICES
    `CREATE TABLE IF NOT EXISTS crop_prices (
      id ${autoIncrement},
      crop_name VARCHAR(100),
      price_per_quintal FLOAT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by INT,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )`,

    // 4. PICKUP REQUESTS
    `CREATE TABLE IF NOT EXISTS pickup_requests (
      id ${autoIncrement},
      farmer_id INT,
      crop_name VARCHAR(100),
      estimated_quantity FLOAT,
      address TEXT,
      pickup_date DATE,
      time_slot VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      assigned_employee_id INT,
      assigned_worker_id INT,
      admin_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farmer_id) REFERENCES users(id),
      FOREIGN KEY (assigned_employee_id) REFERENCES users(id),
      FOREIGN KEY (assigned_worker_id) REFERENCES users(id)
    )`,

    // 5. PROCUREMENTS
    `CREATE TABLE IF NOT EXISTS procurements (
      id ${autoIncrement},
      slip_id VARCHAR(50) UNIQUE,
      pickup_request_id INT,
      farmer_id INT,
      crop_name VARCHAR(100),
      quintals FLOAT,
      rate_per_quintal FLOAT,
      bag_count INT,
      deductions FLOAT,
      total_payout FLOAT,
      weight_image TEXT,
      weighed_by INT,
      edit_status VARCHAR(50) DEFAULT 'none',
      pending_edit_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farmer_id) REFERENCES users(id),
      FOREIGN KEY (pickup_request_id) REFERENCES pickup_requests(id),
      FOREIGN KEY (weighed_by) REFERENCES users(id)
    )`,

    // 6. COSTS PER PROCUREMENT
    `CREATE TABLE IF NOT EXISTS procurement_costs (
      id ${autoIncrement},
      procurement_id INT,
      cost_type VARCHAR(100),
      amount FLOAT,
      note TEXT,
      FOREIGN KEY (procurement_id) REFERENCES procurements(id) ON DELETE CASCADE
    )`,

    // 7. PAYMENTS TO FARMERS
    `CREATE TABLE IF NOT EXISTS farmer_payments (
      id ${autoIncrement},
      farmer_id INT,
      procurement_id INT,
      total_amount FLOAT,
      paid_amount FLOAT,
      due_amount FLOAT,
      payment_mode VARCHAR(50),
      payment_date DATE,
      receipt_url VARCHAR(255),
      FOREIGN KEY (farmer_id) REFERENCES users(id),
      FOREIGN KEY (procurement_id) REFERENCES procurements(id)
    )`,

    // 7B. PAYMENT RECEIPTS
    `CREATE TABLE IF NOT EXISTS payment_receipts (
      id ${autoIncrement},
      receipt_no VARCHAR(50) UNIQUE,
      farmer_id INT,
      procurement_id INT,
      farmer_payment_id INT,
      amount_paid FLOAT,
      payment_mode VARCHAR(50),
      total_amount FLOAT,
      total_paid_after FLOAT,
      due_after FLOAT,
      issued_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farmer_id) REFERENCES users(id),
      FOREIGN KEY (procurement_id) REFERENCES procurements(id),
      FOREIGN KEY (farmer_payment_id) REFERENCES farmer_payments(id),
      FOREIGN KEY (issued_by) REFERENCES users(id)
    )`,

    // 8. INVENTORY
    `CREATE TABLE IF NOT EXISTS inventory (
      id ${autoIncrement},
      crop_name VARCHAR(100),
      current_stock FLOAT,
      warehouse_location VARCHAR(100),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 9. OUTWARD SALES
    `CREATE TABLE IF NOT EXISTS sales (
      id ${autoIncrement},
      crop_name VARCHAR(100),
      quantity FLOAT,
      buyer_name VARCHAR(100),
      sale_price_per_quintal FLOAT,
      total_sale_amount FLOAT,
      truck_number VARCHAR(50),
      dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 10. PROFIT LEDGER
    `CREATE TABLE IF NOT EXISTS profit_ledger (
      id ${autoIncrement},
      procurement_id INT,
      sale_id INT,
      total_cost FLOAT,
      total_sale FLOAT,
      profit FLOAT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (procurement_id) REFERENCES procurements(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )`,

    // 11. ATTENDANCE
    `CREATE TABLE IF NOT EXISTS attendance (
      id ${autoIncrement},
      user_id INT,
      date DATE,
      status VARCHAR(50),
      check_in TIME,
      check_out TIME,
      working_hours FLOAT,
      daily_pay FLOAT DEFAULT 0.0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // 12. TASKS
    `CREATE TABLE IF NOT EXISTS tasks (
      id ${autoIncrement},
      assigned_to INT,
      assigned_by INT,
      title VARCHAR(200),
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      due_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    )`,

    // 13. VEHICLES
    `CREATE TABLE IF NOT EXISTS vehicles (
      id ${autoIncrement},
      vehicle_number VARCHAR(50),
      type VARCHAR(50),
      assigned_to INT,
      fuel_expense FLOAT DEFAULT 0,
      km_driven FLOAT DEFAULT 0,
      last_updated DATE,
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )`,

    // 14. DUES & ADVANCES
    `CREATE TABLE IF NOT EXISTS dues_advances (
      id ${autoIncrement},
      user_id INT,
      type VARCHAR(50),
      amount FLOAT,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // 15. NOTIFICATIONS
    `CREATE TABLE IF NOT EXISTS notifications (
      id ${autoIncrement},
      user_id INT,
      title VARCHAR(200),
      message TEXT,
      is_read ${booleanType} DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // 17. CHAT MESSAGES
    `CREATE TABLE IF NOT EXISTS messages (
      id ${autoIncrement},
      sender_id INT,
      receiver_id INT,
      message TEXT,
      media_url VARCHAR(255),
      is_read ${booleanType} DEFAULT FALSE,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )`,

    // 18. FORGOT PASSWORD REQUESTS
    `CREATE TABLE IF NOT EXISTS forgot_password_requests (
      id ${autoIncrement},
      phone VARCHAR(15),
      last_password VARCHAR(255),
      last_pin VARCHAR(10),
      name VARCHAR(100),
      village VARCHAR(100),
      new_password VARCHAR(255),
      new_pin VARCHAR(10),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await db.run(query);
  }

  // Safety migrations for existing database columns (e.g. edit_status, pending_edit_json)
  try {
    await db.run(`ALTER TABLE procurements ADD COLUMN IF NOT EXISTS edit_status VARCHAR(50) DEFAULT 'none'`);
  } catch (e) {
    console.log('Procurements edit_status migration checked/skipped:', e.message);
  }
  try {
    await db.run(`ALTER TABLE procurements ADD COLUMN IF NOT EXISTS pending_edit_json TEXT`);
  } catch (e) {
    console.log('Procurements pending_edit_json migration checked/skipped:', e.message);
  }
  try {
    await db.run(`ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(20) DEFAULT 'installment'`);
  } catch (e) {
    console.log('payment_receipts receipt_type migration checked/skipped:', e.message);
  }
  try {
    await db.run(`ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS payment_breakdown TEXT`);
  } catch (e) {
    console.log('payment_receipts payment_breakdown migration checked/skipped:', e.message);
  }

  try {
    await db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_type VARCHAR(20) DEFAULT 'hourly'`);
  } catch (e) {
    console.log('users pay_type migration checked/skipped:', e.message);
  }

  try {
    await db.run(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS daily_pay FLOAT DEFAULT 0.0`);
  } catch (e) {
    console.log('attendance daily_pay migration checked/skipped:', e.message);
  }

  try {
    await db.run(`UPDATE users SET pay_type = 'daily' WHERE role IN ('worker', 'employee', 'supervisor')`);
    console.log('Migrated all staff members to daily wage pay type successfully.');
  } catch (e) {
    console.log('Skipped staff pay type updates:', e.message);
  }
  
  console.log('All migrations completed successfully.');
}

async function runSeeders() {
  const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (usersCount.count > 0) {
    console.log('Database already has data. Skipping seeders.');
    return;
  }

  console.log('Seeding database with initial mock data...');

  const hashedAdmin = bcrypt.hashSync('admin123', 8);
  const hashedFarmer = bcrypt.hashSync('farmer123', 8);
  const hashedEmployee = bcrypt.hashSync('employee123', 8);
  const hashedWorker = bcrypt.hashSync('worker123', 8);

  const users = [
    { name: 'Rajesh Kumar (Owner)', phone: '9876543210', email: 'admin@farmease.in', password: hashedAdmin, pin: '1234', role: 'admin', upi_id: 'rajesh@okaxis', address: '12, Grain Market Yard', village: 'Karnal', language: 'english', pay_rate: 0.0, working_hours: 0.0 },
    { name: 'Ramesh Patel', phone: '9123456780', email: 'farmer@farmease.in', password: hashedFarmer, pin: '111111', role: 'farmer', upi_id: 'rameshpatel@upi', address: 'Farm house #4, Near Temple', village: 'Gokulpur', language: 'hindi', pay_rate: 0.0, working_hours: 0.0 },
    { name: 'Suresh Singh', phone: '9234567890', email: 'suresh@farmease.in', password: hashedFarmer, pin: '222222', role: 'farmer', upi_id: 'sureshsingh@ybl', address: 'Plot 29, North Ward', village: 'Gokulpur', language: 'hindi', pay_rate: 0.0, working_hours: 0.0 },
    { name: 'Amit Sharma (Field Head)', phone: '9345678901', email: 'employee@farmease.in', password: hashedEmployee, pin: '3333', role: 'employee', upi_id: 'amitsharma@paytm', address: 'Sector 5, Housing Board', village: 'Karnal', language: 'english', pay_rate: 150.0, working_hours: 45.0 },
    { name: 'Vijay Yadav (Field Driver)', phone: '9456789012', email: 'worker@farmease.in', password: hashedWorker, pin: '222222', role: 'worker', upi_id: 'vijayyadav@okicici', address: 'Chawl No. 4, Subhash Nagar', village: 'Karnal', language: 'hindi', pay_rate: 100.0, working_hours: 32.0 },
    { name: 'Mohan Lal (Helper)', phone: '9567890123', email: 'mohan@farmease.in', password: hashedWorker, pin: '555555', role: 'worker', upi_id: 'mohanlal@upi', address: 'Station Road', village: 'Karnal', language: 'hindi', pay_rate: 80.0, working_hours: 40.0 }
  ];

  for (const u of users) {
    await db.run(
      `INSERT INTO users (name, phone, email, password, pin, role, upi_id, address, village, language, pay_rate, working_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.name, u.phone, u.email, u.password, u.pin, u.role, u.upi_id, u.address, u.village, u.language, u.pay_rate, u.working_hours]
    );
  }

  const seededUsers = await db.all('SELECT id, role, name FROM users');
  const getUserId = (role, name) => seededUsers.find(u => u.role === role && (!name || u.name.includes(name))).id;

  const adminId = getUserId('admin');
  const rameshId = getUserId('farmer', 'Ramesh');
  const sureshId = getUserId('farmer', 'Suresh');
  const employeeId = getUserId('employee');
  const workerId = getUserId('worker', 'Vijay');
  const workerMohanId = getUserId('worker', 'Mohan');

  // 2. Seed Farms
  await db.run(`INSERT INTO farms (farmer_id, location_lat, location_lng, area_acres, soil_type) VALUES (?, ?, ?, ?, ?)`, [rameshId, 29.6857, 76.9905, 5.5, 'Alluvial']);
  await db.run(`INSERT INTO farms (farmer_id, location_lat, location_lng, area_acres, soil_type) VALUES (?, ?, ?, ?, ?)`, [sureshId, 29.6921, 76.9942, 12.0, 'Clay Loam']);

  // 3. Seed Crop Prices
  const crops = [
    { name: 'Wheat', price: 2275.0 },
    { name: 'Paddy (Rice)', price: 2183.0 },
    { name: 'Soybean', price: 4600.0 },
    { name: 'Mustard', price: 5450.0 }
  ];

  for (const c of crops) {
    await db.run(`INSERT INTO crop_prices (crop_name, price_per_quintal, updated_by) VALUES (?, ?, ?)`, [c.name, c.price, adminId]);
  }

  // 4. Seed Pickup Requests
  const pickups = [
    { farmer_id: rameshId, crop_name: 'Wheat', estimated_quantity: 8.5, address: 'Farm house #4, Gokulpur', pickup_date: '2026-05-24', time_slot: 'Morning (08:00 AM - 12:00 PM)', status: 'assigned', employee_id: employeeId, worker_id: workerId, note: 'Approved and assigned. Scheduled for harvest.' },
    { farmer_id: sureshId, crop_name: 'Paddy (Rice)', estimated_quantity: 15.0, address: 'Plot 29, North Ward, Gokulpur', pickup_date: '2026-05-28', time_slot: 'Afternoon (12:00 PM - 04:00 PM)', status: 'assigned', employee_id: employeeId, worker_id: workerId, note: 'Ready to harvest. Assigned worker.' },
    { farmer_id: rameshId, crop_name: 'Soybean', estimated_quantity: 4.0, address: 'Farm house #4, Gokulpur', pickup_date: '2026-05-30', time_slot: 'Morning (08:00 AM - 12:00 PM)', status: 'pending', employee_id: null, worker_id: null, note: 'First harvest pickup.' }
  ];

  for (const p of pickups) {
    await db.run(
      `INSERT INTO pickup_requests (farmer_id, crop_name, estimated_quantity, address, pickup_date, time_slot, status, assigned_employee_id, assigned_worker_id, admin_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.farmer_id, p.crop_name, p.estimated_quantity, p.address, p.pickup_date, p.time_slot, p.status, p.employee_id, p.worker_id, p.note]
    );
  }

  const assignedPickup = await db.get("SELECT id FROM pickup_requests WHERE status = 'assigned' LIMIT 1");

  // 8. Seed Inventory
  await db.run(`INSERT INTO inventory (crop_name, current_stock, warehouse_location) VALUES (?, ?, ?)`, ['Wheat', 80.40, 'Warehouse Block-C']);
  await db.run(`INSERT INTO inventory (crop_name, current_stock, warehouse_location) VALUES (?, ?, ?)`, ['Paddy (Rice)', 45.0, 'Warehouse Block-A']);



  // 11. Seed Attendance
  const dates = ['2026-05-24', '2026-05-25', '2026-05-26'];
  for (const d of dates) {
    await db.run(`INSERT INTO attendance (user_id, date, status, check_in, check_out, working_hours) VALUES (?, ?, ?, ?, ?, ?)`, [employeeId, d, 'present', '09:00:00', '18:00:00', 9.0]);
  }

  // 12. Seed Tasks
  await db.run(`INSERT INTO tasks (assigned_to, assigned_by, title, description, status, due_date) VALUES (?, ?, ?, ?, ?, ?)`, [workerId, employeeId, 'Collect Wheat samples', 'Take grade samples from Ramesh Patels wheat lot.', 'done', '2026-05-24']);
  await db.run(`INSERT INTO tasks (assigned_to, assigned_by, title, description, status, due_date) VALUES (?, ?, ?, ?, ?, ?)`, [workerId, employeeId, 'Execute pickup at Gokulpur', 'Assigned pickup request id: ' + assignedPickup.id, 'pending', '2026-05-28']);

  // 13. Seed Vehicles
  await db.run(`INSERT INTO vehicles (vehicle_number, type, assigned_to, fuel_expense, km_driven, last_updated) VALUES (?, ?, ?, ?, ?, ?)`, ['HR-56-Y-7890', 'Tractor Trolley', workerId, 0.0, 0.0, '2026-05-26']);
  await db.run(`INSERT INTO vehicles (vehicle_number, type, assigned_to, fuel_expense, km_driven, last_updated) VALUES (?, ?, ?, ?, ?, ?)`, ['HR-56-Z-1122', 'Mahindra Pickup', workerMohanId, 0.0, 0.0, '2026-05-26']);

  // 14. Seed Dues & Advances
  await db.run(`INSERT INTO dues_advances (user_id, type, amount, reason, status) VALUES (?, 'advance', ?, ?, 'pending')`, [workerId, 2000.0, 'Festival advance (Eid/Diwali)']);

  // 15. Seed Notifications
  await db.run(`INSERT INTO notifications (user_id, title, message, is_read) VALUES (?, 'New Task Assigned 🚜', 'You have been assigned a pickup request in Gokulpur village for May 28th.', FALSE)`, [workerId]);

  // Seed chat messages directly in the messages table
  try {
    await db.run(
      `INSERT INTO messages (sender_id, receiver_id, message, is_read, sent_at) VALUES (?, ?, ?, FALSE, ?)`,
      [workerId, adminId, 'Sir, I have reached Gokulpur farm. Beginning Wheat quality checks now.', new Date(Date.now() - 3600000).toISOString()]
    );
    await db.run(
      `INSERT INTO messages (sender_id, receiver_id, message, is_read, sent_at) VALUES (?, ?, ?, TRUE, ?)`,
      [adminId, workerId, 'Great Vijay. Verify the moisture pct carefully before finalizing.', new Date(Date.now() - 3000000).toISOString()]
    );
  } catch (err) {
    console.log('Chat messages seeding skipped or error:', err.message);
  }

  console.log('Seeding completed successfully!');
}

module.exports = {
  db,
  initDB
};
