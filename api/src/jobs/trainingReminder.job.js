const cron = require('node-cron');
const { runDaily } = require('../services/trainingReminder.service');

const TIMEZONE = process.env.REENGAGEMENT_TZ || 'Europe/Paris';
// 7h : la séance du jour arrive avant la journée, le ressenti de la veille aussi.
const SCHEDULE = process.env.TRAINING_REMINDER_CRON || '0 7 * * *';

function start() {
  cron.schedule(SCHEDULE, async () => {
    try {
      await runDaily();
    } catch (e) {
      console.error('[rappels] erreur run quotidien:', e);
    }
  }, { timezone: TIMEZONE });
}

module.exports = { start };
