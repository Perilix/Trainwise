// Déclenchement manuel du job d'alertes coach (séances manquées + statuts).
// Usage : node src/scripts/runAthleteAlerts.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { runDaily } = require('../services/athleteAlert.service');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    process.stdout.write(`Connecté à MongoDB\n`);

    const summary = await runDaily();
    process.stdout.write(`Résumé : ${JSON.stringify(summary, null, 2)}\n`);
  } catch (e) {
    console.error('Erreur :', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
