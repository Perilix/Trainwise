const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const runRoutes = require('./routes/run.routes');
const authRoutes = require('./routes/auth.routes');
const planningRoutes = require('./routes/planning.routes');
const stravaRoutes = require('./routes/strava.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/strava', stravaRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/runiq')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
