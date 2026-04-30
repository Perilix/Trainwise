const PlannedRun = require('../models/plannedRun.model');

/**
 * Marks planned sessions on the same day as 'completed' when a real session is logged.
 * Prevents duplicates when an athlete imports or manually adds a session that matches a plan.
 * Returns the matched planned sessions BEFORE deletion so callers can build snapshots / notify coaches.
 */
async function autoCompletePlannedSessions(userId, date, activityType = 'running') {
  const d = new Date(date);
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

  // Pour les courses, matcher aussi les séances sans activityType (valeur par défaut = running)
  const activityTypeConditions = activityType === 'running'
    ? [{ activityType: 'running' }, { activityType: { $exists: false } }, { activityType: null }]
    : [{ activityType }];

  const query = {
    user: userId,
    date: { $gte: dayStart, $lte: dayEnd },
    $or: activityTypeConditions,
    status: 'planned',
    generatedBy: { $in: ['ai', 'coach'] }
  };

  const matched = await PlannedRun.find(query).lean();
  if (matched.length > 0) {
    await PlannedRun.deleteMany({ _id: { $in: matched.map(p => p._id) } });
  }
  return matched;
}

module.exports = { autoCompletePlannedSessions };
