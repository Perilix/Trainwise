const mongoose = require('mongoose');

// Action cochée du plan de lancement (clés dans config/launchPlan.js).
// Propre au back-office : l'API ne la lit pas.
const launchTaskSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('LaunchTask', launchTaskSchema);
