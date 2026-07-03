const cron = require('node-cron');
const { runDaily } = require('../services/athleteAlert.service');

const TIMEZONE = process.env.REENGAGEMENT_TZ || 'Europe/Paris';
// Tous les jours à 8h par défaut ; surchargeable (tests, décalage prod…)
const SCHEDULE = process.env.ATHLETE_ALERT_CRON || '0 8 * * *';

function start() {
  // Séances manquées + statuts athlètes + alertes coach
  cron.schedule(SCHEDULE, async () => {
    console.log('⏰ [athleteAlert] run quotidien…');
    try {
      const summary = await runDaily();
      console.log('✅ [athleteAlert] quotidien terminé:', JSON.stringify(summary));
    } catch (e) {
      console.error('❌ [athleteAlert] erreur run quotidien:', e);
    }
  }, { timezone: TIMEZONE });

  console.log(`✅ Job alertes coach planifié (fuseau ${TIMEZONE})`);
}

module.exports = { start };
