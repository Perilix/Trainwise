const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  distance: { type: Number },
  duration: { type: Number },
  averagePace: { type: String },
  sessionType: { type: String },
  feeling: { type: Number },
  stravaActivityId: { type: Number, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Run', runSchema);
