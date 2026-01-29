const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  reps: {
    type: Number,
    required: true,
    min: 1
  },
  weight: {
    type: Number, // kg
    min: 0
  },
  rpe: {
    type: Number, // Rate of Perceived Exertion 1-10
    min: 1,
    max: 10
  },
  notes: String
}, { _id: false });

const exerciseEntrySchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  },
  sets: [setSchema],
  order: {
    type: Number,
    default: 0
  },
  notes: String
});

const strengthSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  duration: {
    type: Number, // minutes
    min: 0
  },
  sessionType: {
    type: String,
    enum: ['upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit', 'other'],
    default: 'full_body'
  },
  exercises: [exerciseEntrySchema],
  notes: {
    type: String,
    trim: true
  },
  feeling: {
    type: Number, // 1-10
    min: 1,
    max: 10
  },

  // Lien avec séance planifiée (optionnel)
  linkedPlannedSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlannedRun'
  }
}, {
  timestamps: true
});

// Index pour les requêtes
strengthSessionSchema.index({ user: 1, date: -1 });
strengthSessionSchema.index({ user: 1, sessionType: 1 });

// Virtuals pour les stats
strengthSessionSchema.virtual('totalSets').get(function() {
  return this.exercises.reduce((total, ex) => total + ex.sets.length, 0);
});

strengthSessionSchema.virtual('totalReps').get(function() {
  return this.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((sum, set) => sum + set.reps, 0);
  }, 0);
});

strengthSessionSchema.virtual('totalVolume').get(function() {
  return this.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((sum, set) => sum + (set.reps * (set.weight || 0)), 0);
  }, 0);
});

// Inclure les virtuals dans JSON
strengthSessionSchema.set('toJSON', { virtuals: true });
strengthSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StrengthSession', strengthSessionSchema);
