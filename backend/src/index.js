const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const runRoutes = require('./routes/run.routes');
const authRoutes = require('./routes/auth.routes');
const planningRoutes = require('./routes/planning.routes');
const stravaRoutes = require('./routes/strava.routes');
const chatRoutes = require('./routes/chat.routes');
const coachRoutes = require('./routes/coach.routes');
const sessionTemplateRoutes = require('./routes/sessionTemplate.routes');
const athleteRoutes = require('./routes/athlete.routes');
const notificationRoutes = require('./routes/notification.routes');
const friendRoutes = require('./routes/friend.routes');
const exerciseRoutes = require('./routes/exercise.routes');
const strengthRoutes = require('./routes/strength.routes');
const pushNotificationRoutes = require('./routes/pushNotification.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const betaFeedbackRoutes = require('./routes/betaFeedback.routes');
const competitionRoutes = require('./routes/competition.routes');
const { initializeSocket } = require('./socket/index');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// CORS doit être AVANT helmet pour que les preflight OPTIONS passent
const allowedOrigins = [
  'http://localhost:4200',
  'http://192.168.1.31:4200',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
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
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Répondre aux preflight OPTIONS immédiatement
app.options(/(.*)/, cors(corsOptions));

// Security headers (après CORS)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // nécessaire pour Capacitor/Ionic
  contentSecurityPolicy: false      // géré côté frontend Angular
}));

// Sanitize MongoDB queries (protection injection NoSQL)
// Note: express-mongo-sanitize ne peut pas réassigner req.query en Express 5 (getter uniquement)
// On sanitize body et params manuellement
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  next();
});

// Rate limit global — 200 req/min par IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans une minute.' }
}));

app.use(express.json());

// Swagger API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/coach/session-templates', sessionTemplateRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/athlete', athleteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/strength', strengthRoutes);
app.use('/api/users', pushNotificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/beta', betaFeedbackRoutes);
app.use('/api/competitions', competitionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Pages légales publiques (requis Apple / RGPD)
const path = require('path');
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'legal', 'privacy.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trainwise')
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

    // Jobs planifiés (relances de ré-engagement)
    require('./jobs/reengagement.job').start();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
