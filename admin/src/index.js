const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const usersRoutes = require('./routes/users.routes');
const revenueRoutes = require('./routes/revenue.routes');
const aiRoutes = require('./routes/ai.routes');
const runsRoutes = require('./routes/runs.routes');
const coachesRoutes = require('./routes/coaches.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'admin-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8h
}));

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/users', usersRoutes);
app.use('/revenue', revenueRoutes);
app.use('/ai', aiRoutes);
app.use('/runs', runsRoutes);
app.use('/coaches', coachesRoutes);
app.use('/notifications', notificationsRoutes);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Trainwise Admin running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
