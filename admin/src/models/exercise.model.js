const mongoose = require('mongoose');

// Exercice du catalogue : le back-office n'en affiche que le nom.
const exerciseSchema = new mongoose.Schema({
  name: String,
  primaryMuscle: String,
  equipment: String
}, { timestamps: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
