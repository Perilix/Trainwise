const mongoose = require('mongoose');

const coachAthleteSchema = new mongoose.Schema({
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  athlete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    // 'pending' = invitation coach → athlète ; 'requested' = demande athlète → coach
    enum: ['pending', 'requested', 'accepted', 'rejected'],
    default: 'pending'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  },
  inviteMethod: {
    type: String,
    enum: ['code', 'direct', 'request'],
    required: true
  },
  packageType: {
    type: String,
    enum: ['invited', 'bronze', 'silver', 'gold'],
    default: 'silver'
  },
  // Dernier statut de forme calculé par le job quotidien (null = jamais calculé).
  // Sert de référence pour détecter les dégradations et alerter le coach.
  athleteStatus: {
    type: String,
    enum: ['green', 'orange', 'red'],
    default: null
  },
  athleteStatusUpdatedAt: {
    type: Date,
    default: null
  },
  // Historique des changements de statut (une entrée par transition, ~60 max),
  // alimenté par le job quotidien. Permet d'afficher l'évolution côté coach.
  statusHistory: {
    type: [{
      _id: false,
      status: { type: String, enum: ['green', 'orange', 'red'], required: true },
      date: { type: Date, required: true }
    }],
    default: []
  },
  // Anti-spam des alertes coach
  lastAlertAt: {
    type: Date,
    default: null
  },
  lastAlertStatus: {
    type: String,
    enum: ['orange', 'red'],
    default: null
  }
}, {
  timestamps: true
});

// Index pour récupérer efficacement les athlètes d'un coach
coachAthleteSchema.index({ coach: 1, status: 1 });
coachAthleteSchema.index({ athlete: 1, status: 1 });
// Index unique pour éviter les doublons coach-athlete
coachAthleteSchema.index({ coach: 1, athlete: 1 }, { unique: true });

module.exports = mongoose.model('CoachAthlete', coachAthleteSchema);
