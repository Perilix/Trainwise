const Competition = require('../models/competition.model');

// Récupère les N prochaines compétitions (status=upcoming, date >= aujourd'hui)
// d'un utilisateur, formatées pour injection dans le contexte IA.
async function getUpcomingCompetitionsForContext(userId, limit = 3) {
  const now = new Date();
  const competitions = await Competition.find({
    user: userId,
    status: 'upcoming',
    date: { $gte: now }
  })
    .sort({ date: 1 })
    .limit(limit)
    .lean();

  return competitions.map(c => ({
    name: c.name,
    date: c.date,
    discipline: c.discipline,
    distance: c.distance,
    elevationGain: c.elevationGain,
    targetTime: c.targetTime,
    priority: c.priority,
    location: c.location
  }));
}

module.exports = { getUpcomingCompetitionsForContext };
