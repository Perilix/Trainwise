const mongoose = require('mongoose');

// Séance de musculation réalisée. Schéma minimal : le back-office la liste,
// la consulte et la supprime, il ne la modifie pas.
const strengthSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: Date,
  duration: Number,
  sessionType: String,
  feeling: Number,
  notes: String,
  stravaActivityId: Number,
  needsReview: Boolean,
  linkedPlannedSession: { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedRun' },
  exercises: [{
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
    sets: [{ reps: Number, weight: Number, rpe: Number, notes: String }],
    order: Number,
    notes: String,
    block: { kind: String, pairIndex: Number, slot: String },
    target: { sets: Number, reps: String, weight: Number, rest: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('StrengthSession', strengthSessionSchema);
