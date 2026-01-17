const mongoose = require('mongoose');

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
  analyzedAt: { type: Date }
}, {
  timestamps: true
});

module.exports = mongoose.model('Run', runSchema);
