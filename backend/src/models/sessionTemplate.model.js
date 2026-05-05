const mongoose = require('mongoose');
const { ZONE_KEYS } = require('../constants/paceZones');

const paceConfigSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['absolute', 'vmaPercent', 'zone'],
    default: 'zone'
  },
  zone: {
    type: String,
    enum: [...ZONE_KEYS, null],
    default: null
  },
  vmaPercent: { type: Number, min: 30, max: 150, default: null },
  absolute: { type: String, default: null }
}, { _id: false });

const templateRunBlockSchema = new mongoose.Schema({
  role: { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
  mode: { type: String, enum: ['distance', 'duration'], default: 'distance' },
  distance: { type: Number, default: null },
  duration: { type: Number, default: null },
  pace: { type: paceConfigSchema, default: () => ({ mode: 'zone', zone: 'endurance' }) },
  repetitions: { type: Number, default: 1, min: 1 },
  description: { type: String, default: '' },
  recoveryMode: { type: String, enum: ['distance', 'duration', null], default: null },
  recoveryDistance: { type: Number, default: null },
  recoveryDuration: { type: Number, default: null },
  recoveryPace: { type: paceConfigSchema, default: null },
  recoveryDescription: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { _id: false });

const strengthPlanSchema = new mongoose.Schema({
  exercises: [{
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    targetSets: Number,
    targetReps: String,
    targetWeight: Number,
    targetRest: String,
    notes: String
  }],
  circuit: {
    name: String,
    rounds: { type: Number, default: 3 },
    restBetweenRounds: { type: Number, default: 60 },
    exercises: [{
      exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
      targetSets: Number,
      targetReps: String,
      targetWeight: Number,
      targetRest: String,
      notes: String
    }]
  },
  superset: {
    name: String,
    sets: { type: Number, default: 4 },
    restBetweenSets: { type: Number, default: 90 },
    pairs: [{
      a: {
        exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
        targetSets: Number,
        targetReps: String,
        targetWeight: Number,
        targetRest: String,
        notes: String
      },
      b: {
        exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
        targetSets: Number,
        targetReps: String,
        targetWeight: Number,
        targetRest: String,
        notes: String
      }
    }]
  },
  estimatedDuration: Number
}, { _id: false });

const sessionTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nom de la séance requis'],
    trim: true
  },
  description: { type: String, trim: true },
  sport: {
    type: String,
    enum: ['running', 'strength'],
    required: true
  },
  sessionType: {
    type: String,
    enum: [
      'endurance', 'fractionne', 'tempo', 'recuperation', 'sortie_longue', 'cotes', 'fartlek',
      'upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit'
    ],
    required: true
  },

  targetDistance: { type: Number, default: null },
  targetDuration: { type: Number, default: null },
  warmup: { type: String, trim: true },
  mainWorkout: { type: String, trim: true },
  cooldown: { type: String, trim: true },

  runBlocks: { type: [templateRunBlockSchema], default: [] },
  strengthPlan: { type: strengthPlanSchema, default: null },

  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{ type: String, trim: true }],
  isPublic: { type: Boolean, default: false },

  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null }
}, {
  timestamps: true
});

sessionTemplateSchema.index({ coach: 1, sport: 1 });
sessionTemplateSchema.index({ isPublic: 1, sport: 1 });
sessionTemplateSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('SessionTemplate', sessionTemplateSchema);
