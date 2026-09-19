const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const PlannedRun = require('../models/plannedRun.model');

const DAY = 24 * 60 * 60 * 1000;
const STATUS_ORDER = { green: 0, orange: 1, red: 2 };

// Volume hebdo habituel minimum (km) pour que la baisse de volume soit significative
const VOLUME_DROP_MIN_BASELINE_KM = 10;

// Seuils par défaut. Un coach abonné peut les redéfinir (plan Studio) ; sans
// réglage, tout le monde garde ceux-là.
const DEFAULT_RULES = {
  inactivityOrange: 7,
  inactivityRed: 14,
  skippedOrange: 1,
  skippedRed: 3,
  feelingOrange: 7,
  feelingRed: 4,
  volumeDropEnabled: true,
  volumeDropPercent: 50
};

const withDefaults = (rules) => ({ ...DEFAULT_RULES, ...(rules?.toObject ? rules.toObject() : rules || {}) });

const isWorse = (a, b) => STATUS_ORDER[a] > STATUS_ORDER[b];

// Calculer le statut d'un athlète (vert / orange / rouge).
// Statut global = le pire de 4 critères :
//   1. Inactivité : jours depuis la dernière activité (run ou muscu)
//   2. Séances sautées sur les 28 derniers jours
//   3. Ressenti moyen des runs sur les 28 derniers jours
//   4. Baisse de volume : km des 7 derniers jours vs moyenne hebdo des 3 semaines précédentes
async function computeAthleteStatus(athleteId, now = new Date(), coachRules = null) {
  const rules = withDefaults(coachRules);
  const windowStart = new Date(now.getTime() - 28 * DAY);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);

  const [lastRun, lastStrength, skippedCount, recentRuns] = await Promise.all([
    Run.findOne({ user: athleteId }).sort({ date: -1 }).select('date').lean(),
    StrengthSession.findOne({ user: athleteId }).sort({ date: -1 }).select('date').lean(),
    PlannedRun.countDocuments({
      user: athleteId,
      status: 'skipped',
      date: { $gte: windowStart }
    }),
    Run.find({
      user: athleteId,
      date: { $gte: windowStart }
    }).select('date distance feeling').lean()
  ]);

  // Dernière activité
  const dates = [lastRun?.date, lastStrength?.date].filter(Boolean);
  const lastActivityDate = dates.length > 0
    ? new Date(Math.max(...dates.map(d => new Date(d).getTime())))
    : null;

  const daysSince = lastActivityDate
    ? (now.getTime() - new Date(lastActivityDate).getTime()) / DAY
    : Infinity;

  // Ressenti moyen sur 28 jours
  const runsWithFeeling = recentRuns.filter(r => r.feeling !== null && r.feeling !== undefined);
  const avgFeeling = runsWithFeeling.length > 0
    ? runsWithFeeling.reduce((sum, r) => sum + r.feeling, 0) / runsWithFeeling.length
    : null;

  // Volume : 7 derniers jours vs moyenne hebdo des 21 jours précédents (j-28 → j-7)
  let weeklyVolume = 0;
  let baselineVolume = 0;
  for (const r of recentRuns) {
    if (new Date(r.date) >= sevenDaysAgo) weeklyVolume += r.distance || 0;
    else baselineVolume += r.distance || 0;
  }
  const baselineWeeklyVolume = baselineVolume / 3;
  const volumeDrop = rules.volumeDropEnabled
    && baselineWeeklyVolume >= VOLUME_DROP_MIN_BASELINE_KM
    && weeklyVolume < baselineWeeklyVolume * (rules.volumeDropPercent / 100);

  // Statut par critère
  const inactivityStatus = daysSince > rules.inactivityRed ? 'red' : daysSince > rules.inactivityOrange ? 'orange' : 'green';
  const skipStatus = skippedCount >= rules.skippedRed ? 'red' : skippedCount >= rules.skippedOrange ? 'orange' : 'green';
  const feelingStatus = avgFeeling !== null
    ? (avgFeeling < rules.feelingRed ? 'red' : avgFeeling < rules.feelingOrange ? 'orange' : 'green')
    : 'green';
  const volumeStatus = volumeDrop ? 'orange' : 'green';

  // Statut global = le pire des critères
  const status = [inactivityStatus, skipStatus, feelingStatus, volumeStatus]
    .sort((a, b) => STATUS_ORDER[b] - STATUS_ORDER[a])[0];

  return {
    status,
    lastActivityDate,
    daysSinceActivity: isFinite(daysSince) ? Math.floor(daysSince) : null,
    skippedCount,
    avgFeeling: avgFeeling !== null ? Math.round(avgFeeling * 10) / 10 : null,
    weeklyVolume: Math.round(weeklyVolume * 10) / 10,
    baselineWeeklyVolume: Math.round(baselineWeeklyVolume * 10) / 10,
    volumeDrop
  };
}

module.exports = { computeAthleteStatus, isWorse, STATUS_ORDER, DEFAULT_RULES };