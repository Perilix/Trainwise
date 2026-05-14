const PlannedRun = require('../models/plannedRun.model');

function dayBounds(date) {
  const d = new Date(date);
  return {
    dayStart: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)),
    dayEnd:   new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
  };
}

function activityTypeFilter(activityType) {
  return activityType === 'running'
    ? [{ activityType: 'running' }, { activityType: { $exists: false } }, { activityType: null }]
    : [{ activityType }];
}

/**
 * Marks planned sessions on the same day as 'completed' when a real session is logged.
 * Prevents duplicates when an athlete imports or manually adds a session that matches a plan.
 * Returns the matched planned sessions BEFORE deletion so callers can build snapshots / notify coaches.
 */
async function autoCompletePlannedSessions(userId, date, activityType = 'running') {
  const { dayStart, dayEnd } = dayBounds(date);

  const query = {
    user: userId,
    date: { $gte: dayStart, $lte: dayEnd },
    $or: activityTypeFilter(activityType),
    status: 'planned',
    generatedBy: { $in: ['ai', 'coach'] }
  };

  const matched = await PlannedRun.find(query).lean();
  if (matched.length > 0) {
    await PlannedRun.deleteMany({ _id: { $in: matched.map(p => p._id) } });
  }
  return matched;
}

/**
 * Same matching rules as autoCompletePlannedSessions, but READ-ONLY:
 * returns the planned sessions that could match without deleting anything.
 * Used to suggest a confirmation prompt to the athlete after a Strava import.
 *
 * Pas de filtre sur generatedBy (contrairement à autoCompletePlannedSessions qui
 * lui est destructif) : l'athlète confirmera la suggestion, donc on peut aussi
 * proposer les séances qu'il a créées manuellement.
 */
async function findPlannedMatches(userId, date, activityType = 'running') {
  const { dayStart, dayEnd } = dayBounds(date);

  return PlannedRun.find({
    user: userId,
    date: { $gte: dayStart, $lte: dayEnd },
    $or: activityTypeFilter(activityType),
    status: 'planned'
  }).sort({ date: 1 }).lean();
}

module.exports = { autoCompletePlannedSessions, findPlannedMatches };
