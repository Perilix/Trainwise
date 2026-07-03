const PlannedRun = require('../models/plannedRun.model');
const CoachAthlete = require('../models/coachAthlete.model');
const { computeAthleteStatus, isWorse } = require('./athleteStatus.service');
const { createNotification } = require('../controllers/notification.controller');

const DAY = 24 * 60 * 60 * 1000;

// Délai de grâce avant de marquer une séance planifiée comme sautée :
// une séance de lundi restée 'planned' est marquée sautée mercredi matin.
// Laisse le temps aux imports Strava tardifs de la compléter d'abord.
const MISSED_GRACE_DAYS = 1;

// Anti-spam : pas plus d'une alerte par athlète et par coach sur cette fenêtre,
// même si le statut oscille (vert ↔ orange) d'un jour à l'autre.
const ALERT_COOLDOWN_MS = 3 * DAY;

const STATUS_LABELS = { green: 'vert', orange: 'orange', red: 'rouge' };

function startOfToday(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Marque comme sautées les séances planifiées dont la date est passée
// (délai de grâce inclus) et qui n'ont jamais été réalisées.
// `autoSkipped: true` permet à un import tardif de quand même les matcher.
async function markMissedSessions(now = new Date()) {
  const cutoff = new Date(startOfToday(now).getTime() - MISSED_GRACE_DAYS * DAY);

  const result = await PlannedRun.updateMany(
    { status: 'planned', date: { $lt: cutoff } },
    { $set: { status: 'skipped', autoSkipped: true } }
  );

  return { markedMissed: result.modifiedCount };
}

// Construit le détail lisible des raisons du statut pour le message d'alerte
function buildReasons(statusData) {
  const reasons = [];

  if (statusData.daysSinceActivity === null) {
    reasons.push('aucune activité enregistrée');
  } else if (statusData.daysSinceActivity > 7) {
    reasons.push(`aucune activité depuis ${statusData.daysSinceActivity} jours`);
  }

  if (statusData.skippedCount >= 1) {
    reasons.push(`${statusData.skippedCount} séance${statusData.skippedCount > 1 ? 's' : ''} manquée${statusData.skippedCount > 1 ? 's' : ''} sur 4 semaines`);
  }

  if (statusData.avgFeeling !== null && statusData.avgFeeling < 7) {
    reasons.push(`ressenti moyen en baisse (${statusData.avgFeeling}/10)`);
  }

  if (statusData.volumeDrop) {
    reasons.push(`volume en forte baisse (${statusData.weeklyVolume} km cette semaine vs ${statusData.baselineWeeklyVolume} km/sem habituellement)`);
  }

  return reasons;
}

// Recalcule le statut de chaque athlète suivi, le persiste sur la relation
// coach-athlète, et alerte le coach quand le statut se dégrade.
async function checkStatusChanges(now = new Date()) {
  const relations = await CoachAthlete.find({ status: 'accepted' })
    .populate('athlete', 'firstName lastName')
    .lean();

  const summary = { checked: 0, degraded: 0, alertsSent: 0, alertsSkipped: 0 };

  // Un athlète peut apparaître dans plusieurs relations : ne calcule qu'une fois
  const statusCache = new Map();

  for (const rel of relations) {
    if (!rel.athlete) continue;
    summary.checked++;

    const athleteId = rel.athlete._id.toString();
    let statusData = statusCache.get(athleteId);
    if (!statusData) {
      statusData = await computeAthleteStatus(rel.athlete._id, now);
      statusCache.set(athleteId, statusData);
    }

    const previous = rel.athleteStatus;
    const current = statusData.status;

    const update = { $set: { athleteStatus: current, athleteStatusUpdatedAt: now } };
    // Historise chaque transition (et le tout premier calcul)
    if (previous !== current) {
      update.$push = { statusHistory: { $each: [{ status: current, date: now }], $slice: -60 } };
    }
    await CoachAthlete.updateOne({ _id: rel._id }, update);

    // Premier calcul (baseline) ou pas de dégradation → rien à signaler
    if (!previous || !isWorse(current, previous)) continue;
    summary.degraded++;

    // Anti-spam : une alerte récente existe déjà pour cette relation
    if (rel.lastAlertAt && now.getTime() - new Date(rel.lastAlertAt).getTime() < ALERT_COOLDOWN_MS) {
      summary.alertsSkipped++;
      continue;
    }

    const firstName = rel.athlete.firstName;
    const reasons = buildReasons(statusData);
    const title = current === 'red'
      ? `🔴 ${firstName} est en alerte`
      : `🟠 ${firstName} est à surveiller`;
    const message = reasons.length > 0
      ? `Statut passé de ${STATUS_LABELS[previous]} à ${STATUS_LABELS[current]} : ${reasons.join(' · ')}.`
      : `Statut passé de ${STATUS_LABELS[previous]} à ${STATUS_LABELS[current]}.`;

    await createNotification({
      recipient: rel.coach,
      sender: rel.athlete._id,
      type: 'athlete_alert',
      action: 'status_degraded',
      title,
      message,
      actionUrl: `/coach/athletes/${athleteId}`
    });

    await CoachAthlete.updateOne(
      { _id: rel._id },
      { $set: { lastAlertAt: now, lastAlertStatus: current } }
    );
    summary.alertsSent++;
  }

  return summary;
}

// Job quotidien : marquer les séances manquées PUIS recalculer les statuts,
// pour que les séances fraîchement sautées comptent dans le statut du jour.
async function runDaily(now = new Date()) {
  const missed = await markMissedSessions(now);
  const statuses = await checkStatusChanges(now);
  return { ...missed, ...statuses };
}

module.exports = { runDaily, markMissedSessions, checkStatusChanges };
