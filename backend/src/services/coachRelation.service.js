const CoachAthlete = require('../models/coachAthlete.model');

async function athleteHasCoach(userId) {
  if (!userId) return false;
  const relation = await CoachAthlete.findOne({ athlete: userId, status: 'accepted' }).lean();
  return !!relation;
}

module.exports = { athleteHasCoach };
