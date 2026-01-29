const mongoose = require('mongoose');

const plannedRunSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Type d'activité : running (défaut pour backward compat) ou strength
  activityType: {
    type: String,
    enum: ['running', 'strength'],
    default: 'running'
  },
  sessionType: {
    type: String,
    enum: [
      // Running types
      'endurance', 'fractionne', 'tempo', 'recuperation', 'sortie_longue', 'cotes', 'fartlek',
      // Strength types
      'upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit'
    ],
    required: true
  },
  targetDistance: {
    type: Number, // en km
    default: null
  },
  targetDuration: {
    type: Number, // en minutes
    default: null
  },
  targetPace: {
    type: String, // format "5:30"
    default: null
  },
  description: {
    type: String, // conseils IA pour la séance
    trim: true
  },
  warmup: {
    type: String, // description échauffement
    trim: true
  },
  mainWorkout: {
    type: String, // description corps de séance
    trim: true
  },
  cooldown: {
    type: String, // description retour au calme
    trim: true
  },

  // Champs spécifiques musculation (pour séances planifiées)
  strengthPlan: {
    exercises: [{
      exercise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      targetSets: Number,
      targetReps: String, // "8-12" format
      targetWeight: Number, // kg (optionnel)
      notes: String
    }],
    estimatedDuration: Number // minutes
  },

  status: {
    type: String,
    enum: ['planned', 'completed', 'skipped'],
    default: 'planned'
  },
  linkedRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    default: null
  },
  weekNumber: {
    type: Number // numéro de semaine dans le plan
  },
  generatedBy: {
    type: String,
    enum: ['ai', 'manual', 'coach'],
    default: 'ai'
  },
  // Qui a créé cette séance (null = l'athlète lui-même)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Index pour récupérer efficacement les séances d'un utilisateur
plannedRunSchema.index({ user: 1, date: 1 });
plannedRunSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('PlannedRun', plannedRunSchema);
