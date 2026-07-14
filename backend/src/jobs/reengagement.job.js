const cron = require('node-cron');
const { runDaily, runWeeklyRecap } = require('../services/reengagement.service');

const TIMEZONE = process.env.REENGAGEMENT_TZ || 'Europe/Paris';

function start() {
  // Relances quotidiennes (streak / inactif / onboarding) — tous les jours à 18h
  cron.schedule('0 18 * * *', async () => {
    try {
      await runDaily();
    } catch (e) {
      console.error('❌ [reengagement] erreur run quotidien:', e);
    }
  }, { timezone: TIMEZONE });

  // Récap hebdo — dimanche à 11h
  cron.schedule('0 11 * * 0', async () => {
    try {
      await runWeeklyRecap();
    } catch (e) {
      console.error('❌ [reengagement] erreur récap hebdo:', e);
    }
  }, { timezone: TIMEZONE });
}

module.exports = { start };
