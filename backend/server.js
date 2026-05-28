const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initDB } = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 5000;
const requireDb = process.env.REQUIRE_DB === 'true';
let dbReady = false;
let dbInitError = null;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Socket.io Handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins their personal room or role room
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });



  // Chat message (Admin <-> Employee <-> Worker)
  socket.on('send_chat_message', (data) => {
    // data: { sender_id, receiver_id, sender_name, message, timestamp }
    const { receiver_id } = data;
    // Emit to receiver's private room and echo to sender
    io.to(`user_${receiver_id}`).emit('new_chat_message', data);
    io.to(`user_${data.sender_id}`).emit('new_chat_message', data);
  });

  // Global Broadcast from Admin
  socket.on('send_broadcast', (data) => {
    // data: { title, message, sender_name }
    io.emit('new_broadcast', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Pass Socket.io instance to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Import Routes
const authRoutes = require('./routes/auth');
const cropRoutes = require('./routes/crops');
const pickupRoutes = require('./routes/pickups');
const procurementRoutes = require('./routes/procurements');
const taskRoutes = require('./routes/tasks');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');

// When DB is unavailable, keep process alive for easier local debugging,
// but block API traffic with a clear 503 response.
app.use('/api', (req, res, next) => {
  if (dbReady) return next();
  return res.status(503).json({
    error: 'Database unavailable',
    message: dbInitError?.message || 'Database is not ready yet.',
    code: 'DB_UNAVAILABLE'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/pickup', pickupRoutes);
app.use('/api/procurements', procurementRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/farmer', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// Simple Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: dbReady ? 'connected' : 'disconnected',
    dbError: dbReady ? null : (dbInitError?.message || null),
    time: new Date()
  });
});

// Boot Database and Server
async function startServer() {
  try {
    await initDB();
    dbReady = true;
    console.log('✅ Database initialization completed.');
  } catch (error) {
    dbInitError = error;
    if (requireDb) {
      console.error('Failed to start server because database is required:', error);
      process.exit(1);
    }
    console.error('⚠️ Starting server without database connection:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`🚀 FarmEase Server running on port ${PORT}`);
  });
}

startServer();
