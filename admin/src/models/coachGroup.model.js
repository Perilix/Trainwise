const mongoose = require('mongoose');

// Groupe d'athlètes d'un coach — le back-office ne fait qu'en compter.
const coachGroupSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, trim: true },
  race: {
    name: { type: String, default: null },
    date: { type: Date, default: null }
  },
  color: { type: String, default: 'bleu' },
  athletes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('CoachGroup', coachGroupSchema);
