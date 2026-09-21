const mongoose = require('mongoose');

// Message envoyé depuis « Nous contacter », site ou application.
// Copie du modèle de l'API : les deux services se déploient séparément.
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  subject: { type: String, enum: ['question', 'bug', 'compte', 'donnees', 'suggestion', 'autre'], default: 'question' },
  message: { type: String, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['nouveau', 'en_cours', 'traite'], default: 'nouveau' },
  handledAt: { type: Date, default: null },
  meta: {
    source: { type: String, enum: ['site', 'app'], default: 'site' },
    platform: { type: String, default: null },
    appVersion: { type: String, default: null },
    userAgent: { type: String, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
