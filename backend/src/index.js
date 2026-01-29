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
const { initializeSocket } = require('./socket/index');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:4200',
    'http://localhost:4200',
    'http://192.168.1.31:4200',
    'capacitor://localhost',  // iOS Capacitor
    'http://localhost'        // iOS Capacitor fallback
  ],
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/runiq')
  .then(() => {
    console.log('Connected to MongoDB');

    // Initialize Socket.io
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
