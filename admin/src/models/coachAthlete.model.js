const mongoose = require('mongoose');
const coachAthleteSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 'pending' = invitation coach → athlète ; 'requested' = demande athlète → coach
  status: { type: String, enum: ['pending', 'requested', 'accepted', 'rejected'], default: 'pending' },
  invitedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  packageType: { type: String, enum: ['invited', 'bronze', 'silver', 'gold'], default: 'silver' }
}, { timestamps: true });
module.exports = mongoose.model('CoachAthlete', coachAthleteSchema);
