const mongoose = require('mongoose');

/**
 * Un message envoyé depuis « Nous contacter », site ou application.
 *
 * L'expéditeur n'est pas forcément connecté : l'adresse email est donc
 * obligatoire, et le compte n'est rattaché que s'il y en a un.
 */
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Votre nom est requis'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Votre adresse email est requise'],
      trim: true,
      lowercase: true,
      maxlength: 160,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse email invalide']
    },
    subject: {
      type: String,
      enum: ['question', 'bug', 'compte', 'donnees', 'suggestion', 'autre'],
      default: 'question'
    },
    message: { type: String, required: [true, 'Votre message est requis'], trim: true, maxlength: 4000 },

    // Le compte de l'expéditeur, s'il écrivait depuis l'application connectée.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Suivi côté back-office : on sait ce qui reste à traiter.
    status: { type: String, enum: ['nouveau', 'en_cours', 'traite'], default: 'nouveau', index: true },
    handledAt: { type: Date, default: null },

    // De quoi reproduire un bug sans redemander à l'expéditeur.
    meta: {
      source: { type: String, enum: ['site', 'app'], default: 'site' },
      platform: { type: String, default: null },
      appVersion: { type: String, default: null },
      userAgent: { type: String, default: null }
    }
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
