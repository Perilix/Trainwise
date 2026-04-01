const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const runRoutes = require('./routes/run.routes');
const authRoutes = require('./routes/auth.routes');
const planningRoutes = require('./routes/planning.routes');
const stravaRoutes = require('./routes/strava.routes');
const chatRoutes = require('./routes/chat.routes');
const coachRoutes = require('./routes/coach.routes');
const athleteRoutes = require('./routes/athlete.routes');
const notificationRoutes = require('./routes/notification.routes');
const friendRoutes = require('./routes/friend.routes');
const exerciseRoutes = require('./routes/exercise.routes');
const strengthRoutes = require('./routes/strength.routes');
const pushNotificationRoutes = require('./routes/pushNotification.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { initializeSocket } = require('./socket/index');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = [
  'http://localhost:4200',
  'http://192.168.1.31:4200',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps natives, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // En dev uniquement, on autorise tout
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS: origine non autorisée'));
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/athlete', athleteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/strength', strengthRoutes);
app.use('/api/users', pushNotificationRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/runiq')
  .then(async () => {
    console.log('Connected to MongoDB');

    // Fix: drop old non-sparse coachInviteCode index so Mongoose recreates it as sparse
    try {
      const User = require('./models/user.model');
      await User.collection.dropIndex('coachInviteCode_1');
      console.log('Dropped old coachInviteCode index — will be recreated as sparse');
    } catch (e) {
      // Index doesn't exist or already dropped — nothing to do
    }

    // Initialize Socket.io
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
