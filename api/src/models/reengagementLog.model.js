const mongoose = require('mongoose');

// Journal des relances automatiques (ré-engagement) — une ligne par destinataire.
// Alimenté UNIQUEMENT par le cron de ré-engagement, pas par les notifs
// transactionnelles (invitations, messages, etc.).
const reengagementLogSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Dénormalisés pour l'affichage back-office (évite un populate à chaque ligne)
  email: { type: String, default: null },
  firstName: { type: String, default: null },

  type: {
    type: String,
    enum: ['inactive', 'streak', 'recap', 'onboarding'],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, required: true },

  // Résultat de l'envoi push
  status: {
    type: String,
    enum: ['sent', 'failed', 'no_token'],
    required: true
  },
  error: { type: String, default: null },

  sentAt: { type: Date, default: Date.now }
});

reengagementLogSchema.index({ sentAt: -1 });
reengagementLogSchema.index({ type: 1, sentAt: -1 });
reengagementLogSchema.index({ recipient: 1, sentAt: -1 });

module.exports = mongoose.model('ReengagementLog', reengagementLogSchema);
