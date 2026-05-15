const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  discipline: {
    type: String,
    enum: ['5km', '10km', 'semi_marathon', 'marathon', 'trail', 'ultra', 'autre'],
    required: true
  },
  // Distance en km (utile pour trail/ultra/autre où la distance n'est pas implicite)
  distance: {
    type: Number,
    min: 0,
    default: null
  },
  // Dénivelé positif en m (utile trail/ultra)
  elevationGain: {
    type: Number,
    min: 0,
    default: null
  },
  // Temps cible "HH:MM:SS" ou "MM:SS"
  targetTime: {
    type: String,
    default: null,
    trim: true
  },
  // Priorité de l'objectif dans la saison
  priority: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'B'
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  // Résultat (rempli après la course)
  result: {
    finishTime: { type: String, default: null, trim: true },
    position: { type: Number, default: null, min: 1 },
    notes: { type: String, default: '', trim: true },
    linkedRun: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      default: null
    }
  }
}, {
  timestamps: true
});

competitionSchema.index({ user: 1, date: 1 });
competitionSchema.index({ user: 1, status: 1, date: 1 });

module.exports = mongoose.model('Competition', competitionSchema);
