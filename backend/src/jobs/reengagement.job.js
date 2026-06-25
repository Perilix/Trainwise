const cron = require('node-cron');
const { runDaily, runWeeklyRecap } = require('../services/reengagement.service');

const TIMEZONE = process.env.REENGAGEMENT_TZ || 'Europe/Paris';

function start() {
  // Relances quotidiennes (streak / inactif / onboarding) — tous les jours à 18h
  cron.schedule('0 18 * * *', async () => {
    console.log('⏰ [reengagement] run quotidien…');
    try {
      const summary = await runDaily();
      console.log('✅ [reengagement] quotidien terminé:', JSON.stringify(summary));
    } catch (e) {
      console.error('❌ [reengagement] erreur run quotidien:', e);
    }
  }, { timezone: TIMEZONE });

  // Récap hebdo — dimanche à 11h
  cron.schedule('0 11 * * 0', async () => {
    console.log('⏰ [reengagement] récap hebdo…');
    try {
      const summary = await runWeeklyRecap();
      console.log('✅ [reengagement] récap hebdo terminé:', JSON.stringify(summary));
    } catch (e) {
      console.error('❌ [reengagement] erreur récap hebdo:', e);
    }
  }, { timezone: TIMEZONE });

  console.log(`✅ Jobs de ré-engagement planifiés (fuseau ${TIMEZONE})`);
}

module.exports = { start };
