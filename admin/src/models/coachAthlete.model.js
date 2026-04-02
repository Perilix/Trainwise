const mongoose = require('mongoose');
const coachAthleteSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  invitedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  packageType: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'silver' }
}, { timestamps: true });
module.exports = mongoose.model('CoachAthlete', coachAthleteSchema);
