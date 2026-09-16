const cron = require('node-cron');
const { runDaily } = require('../services/athleteAlert.service');

const TIMEZONE = process.env.REENGAGEMENT_TZ || 'Europe/Paris';
// Tous les jours à 8h par défaut ; surchargeable (tests, décalage prod…)
const SCHEDULE = process.env.ATHLETE_ALERT_CRON || '0 8 * * *';

function start() {
  cron.schedule(SCHEDULE, async () => {
    try {
      await runDaily();
    } catch (e) {
      console.error('❌ [athleteAlert] erreur run quotidien:', e);
    }
  }, { timezone: TIMEZONE });
}

module.exports = { start };
