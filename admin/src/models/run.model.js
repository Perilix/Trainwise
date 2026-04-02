const mongoose = require('mongoose');
const runSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  distance: { type: Number },
  duration: { type: Number },
  averagePace: { type: String },
  averageHeartRate: { type: Number },
  elevationGain: { type: Number },
  sessionType: { type: String },
  feeling: { type: Number, min: 1, max: 10 },
  notes: { type: String },
  analysis: { type: String },
  stravaActivityId: { type: Number, default: null }
}, { timestamps: true });
module.exports = mongoose.model('Run', runSchema);
