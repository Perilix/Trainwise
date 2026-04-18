const PlannedRun = require('../models/plannedRun.model');

/**
 * Marks planned sessions on the same day as 'completed' when a real session is logged.
 * Prevents duplicates when an athlete imports or manually adds a session that matches a plan.
 */
async function autoCompletePlannedSessions(userId, date, activityType = 'running') {
  const d = new Date(date);
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

  // Pour les courses, matcher aussi les séances sans activityType (valeur par défaut = running)
  const activityTypeConditions = activityType === 'running'
    ? [{ activityType: 'running' }, { activityType: { $exists: false } }, { activityType: null }]
    : [{ activityType }];

  await PlannedRun.updateMany(
    {
      user: userId,
      date: { $gte: dayStart, $lte: dayEnd },
      $or: activityTypeConditions,
      status: 'planned'
    },
    { $set: { status: 'completed' } }
  );
}

module.exports = { autoCompletePlannedSessions };
