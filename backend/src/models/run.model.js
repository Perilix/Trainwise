const mongoose = require('mongoose');

// Champs d'une étape running réalisée (réutilisés pour les blocs de 1er niveau
// ET les enfants d'un bloc « Répéter » multi-étapes via `children`).
const runBlockStepFields = {
  role: { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
  mode: { type: String, enum: ['distance', 'duration'], default: 'distance' },
  distance: { type: Number, default: null },
  duration: { type: Number, default: null },
  pace: { type: String, default: null },
  repetitions: { type: Number, default: 1, min: 1 },
  description: { type: String, default: '' },
  recoveryMode: { type: String, enum: ['distance', 'duration', null], default: null },
  recoveryDistance: { type: Number, default: null },
  recoveryDuration: { type: String, default: null },
  recoveryPace: { type: String, default: null },
  recoveryDescription: { type: String, default: '' },
  notes: { type: String, default: '' },
  order: { type: Number, default: 0 }
};

const runSchema = new mongoose.Schema({
  // Utilisateur
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Données de base
  date: { type: Date, default: Date.now },
  distance: { type: Number }, // en km
  duration: { type: Number }, // en minutes

  // Allure et vitesse
  averagePace: { type: String }, // format "5:30" min/km

  // Fréquence cardiaque
  averageHeartRate: { type: Number }, // bpm
  maxHeartRate: { type: Number }, // bpm

  // Cadence
  averageCadence: { type: Number }, // ppm (pas par minute)

  // Dénivelé
  elevationGain: { type: Number }, // en mètres

  // Type de séance
  sessionType: { type: String }, // ex: "endurance", "fractionné", "récup"

  // Ressenti
  feeling: { type: Number, min: 1, max: 10 }, // 1-10

  // Notes
  notes: { type: String },

  // Analyse GPT
  analysis: { type: String },
  analyzedAt: { type: Date },

  // Strava
  stravaActivityId: {
    type: Number,
    default: null,
    sparse: true,
    index: true
  },

  // Suggestion de match avec une séance planifiée (proposée à l'import Strava).
  // Tant que non null et matchDismissed=false, un bandeau de confirmation s'affiche côté UI.
  pendingPlannedMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlannedRun',
    default: null
  },
  matchDismissed: {
    type: Boolean,
    default: false
  },
  polyline: {
    type: String,
    default: null
  },
  startLatLng: {
    type: [Number],
    default: null
  },
  endLatLng: {
    type: [Number],
    default: null
  },

  // Blocs réalisés par l'athlète (saisis lors du retour ou a posteriori)
  // Mêmes champs que la séance planifiée mais reflétant ce qui a été fait
  runBlocks: [{
    ...runBlockStepFields,
    children: { type: [runBlockStepFields], default: undefined }
  }],

  // Snapshot figé de ce que le coach avait prévu (copié à la complétion d'une séance planifiée)
  plannedSnapshot: {
    sessionType: { type: String, default: null },
    targetDistance: { type: Number, default: null },
    targetDuration: { type: Number, default: null },
    targetPace: { type: String, default: null },
    description: { type: String, default: null },
    runBlocks: [{
      role: String,
      mode: String,
      distance: Number,
      duration: Number,
      pace: String,
      repetitions: Number,
      description: String,
      recoveryMode: String,
      recoveryDistance: Number,
      recoveryDuration: String,
      recoveryPace: String,
      recoveryDescription: String,
      order: Number,
      children: { type: mongoose.Schema.Types.Mixed, default: undefined }
    }],
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Run', runSchema);
