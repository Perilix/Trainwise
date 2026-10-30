const mongoose = require('mongoose');

// Activité Strava d'un sport que Trainwise ne programme pas (vélo, natation, ski…).
// Simple miroir pour que l'athlète et son coach la voient dans le planning :
// les chiffres clés et, surtout, la description saisie sur Strava.
// La course et la muscu ont leurs propres modèles (Run, StrengthSession).
const otherActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stravaActivityId: {
    type: Number,
    required: true
  },
  sportType: { type: String, required: true }, // sport_type Strava : Ride, Swim, GravelRide…
  name: { type: String, trim: true },
  description: { type: String, trim: true, default: '' },

  date: { type: Date, required: true },
  // Heure locale de l'athlète (« 2026-10-28T07:45:00Z » à lire tel quel) :
  // c'est elle qui fixe le jour dans le calendrier, pas l'heure UTC.
  startDateLocal: { type: String, default: null },

  movingTime: { type: Number, default: null }, // secondes
  elapsedTime: { type: Number, default: null }, // secondes
  distance: { type: Number, default: null }, // km
  elevationGain: { type: Number, default: null }, // m
  averageSpeed: { type: Number, default: null }, // m/s
  averageHeartRate: { type: Number, default: null },
  maxHeartRate: { type: Number, default: null },
  averageWatts: { type: Number, default: null },
  calories: { type: Number, default: null }
}, {
  timestamps: true
});

otherActivitySchema.index({ user: 1, stravaActivityId: 1 }, { unique: true });
otherActivitySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('OtherActivity', otherActivitySchema);
