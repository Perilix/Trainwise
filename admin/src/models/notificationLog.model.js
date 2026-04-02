const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  segment: { type: String, enum: ['all', 'pro', 'free'], default: 'all' },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
