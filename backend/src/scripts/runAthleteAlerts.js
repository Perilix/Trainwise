// Déclenchement manuel du job d'alertes coach (séances manquées + statuts).
// Usage : node src/scripts/runAthleteAlerts.js
require('dotenv').config();
const mongoose = require('mongoose');
const { runDaily } = require('../services/athleteAlert.service');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connecté à MongoDB');

    const summary = await runDaily();
    console.log('Résumé :', JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Erreur :', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
