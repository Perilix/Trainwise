const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String },
  firstName: { type: String },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
}, { _id: false });

const notificationLogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  segment: { type: String, enum: ['all', 'pro', 'free', 'custom'], default: 'all' },
  sent: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  // Qui a créé / envoyé la campagne depuis le back office
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  // Nombre d'appareils ciblés au moment de l'envoi
  targetCount: { type: Number, default: 0 },
  // Liste détaillée des destinataires (dénormalisée pour l'affichage historique)
  recipients: { type: [recipientSchema], default: [] },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
