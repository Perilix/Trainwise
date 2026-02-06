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
    enum: ['pending', 'accepted', 'rejected'],
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
    enum: ['code', 'direct'],
    required: true
  },
  packageType: {
    type: String,
    enum: ['bronze', 'silver', 'gold'],
    default: 'silver'
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
