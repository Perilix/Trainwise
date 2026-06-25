const mongoose = require('mongoose');

// Miroir du modèle backend (lecture seule côté back-office).
const reengagementLogSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, default: null },
  firstName: { type: String, default: null },
  type: { type: String, enum: ['inactive', 'streak', 'recap', 'onboarding'] },
  title: { type: String },
  body: { type: String },
  status: { type: String, enum: ['sent', 'failed', 'no_token'] },
  error: { type: String, default: null },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ReengagementLog', reengagementLogSchema);
