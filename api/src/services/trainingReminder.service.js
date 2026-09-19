const PlannedRun = require('../models/plannedRun.model');
const Run = require('../models/run.model');
const Competition = require('../models/competition.model');
const { createNotification } = require('../controllers/notification.controller');

// Rappels quotidiens liés à l'entraînement : la séance du jour, le ressenti à
// compléter, et les échéances de compétition. Le reste des notifications part
// d'une action (un coach qui planifie, une sortie qui arrive de Strava).

const SESSION_TYPE_LABELS = {
  endurance: 'Endurance', fractionne: 'Fractionné', tempo: 'Tempo', recuperation: 'Récupération',
  sortie_longue: 'Sortie longue', cotes: 'Côtes', fartlek: 'Fartlek',
  upper_body: 'Renfo haut du corps', lower_body: 'Renfo bas du corps', full_body: 'Renfo corps complet',
  push: 'Renfo poussée', pull: 'Renfo tirage', legs: 'Renfo jambes', core: 'Gainage', hiit: 'HIIT'
};

const dayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const sessionLabel = (planned) =>
  planned.title || SESSION_TYPE_LABELS[planned.sessionType] || (planned.activityType === 'strength' ? 'Renforcement' : 'Course');

/** « Séance d'entraînement prévue aujourd'hui : … » */
async function remindTodaySessions(now = new Date()) {
  const { start, end } = dayBounds(now);
  const sessions = await PlannedRun.find({ date: { $gte: start, $lte: end }, status: 'planned' }).lean();

  for (const planned of sessions) {
    await createNotification({
      recipient: planned.user,
      type: 'session',
      action: 'session_reminder',
      title: 'Séance prévue aujourd’hui',
      message: `Séance d’entraînement prévue aujourd’hui : ${sessionLabel(planned)}`,
      actionUrl: '/planning'
    });
  }
  return sessions.length;
}

/**
 * « Comment s'est passée ta séance ? » — pour les sorties de la veille restées
 * sans ressenti. `feedbackReminderAt` garantit qu'on ne relance qu'une fois.
 */
async function remindMissingFeedback(now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const { start, end } = dayBounds(yesterday);

  const runs = await Run.find({
    date: { $gte: start, $lte: end },
    feeling: { $in: [null, undefined] },
    feedbackReminderAt: null
  }).lean();

  for (const run of runs) {
    await createNotification({
      recipient: run.user,
      type: 'session',
      action: 'feedback_missing',
      title: 'Comment s’est passée ta séance ?',
      message: 'Ajoute ton ressenti sur ta sortie d’hier, ton coach le verra.',
      actionUrl: `/run/${run._id}`
    });
    await Run.updateOne({ _id: run._id }, { $set: { feedbackReminderAt: new Date() } });
  }
  return runs.length;
}

// Jalons de compte à rebours : assez espacés pour ne pas harceler.
const COUNTDOWN_DAYS = [30, 7, 1];

/** « J-7 avant ton semi-marathon de Berlin » */
async function remindCompetitions(now = new Date()) {
  let sent = 0;

  for (const days of COUNTDOWN_DAYS) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const { start, end } = dayBounds(target);

    const competitions = await Competition.find({ date: { $gte: start, $lte: end } }).lean();
    for (const competition of competitions) {
      await createNotification({
        recipient: competition.user,
        type: 'competition',
        action: 'competition_soon',
        title: days === 1 ? 'C’est demain !' : `J-${days}`,
        message: days === 1 ? `Demain, ${competition.name}. Repose-toi bien.` : `J-${days} avant ${competition.name}.`,
        actionUrl: '/planning'
      });
      sent += 1;
    }
  }
  return sent;
}

async function runDaily(now = new Date()) {
  const sessions = await remindTodaySessions(now);
  const feedback = await remindMissingFeedback(now);
  const competitions = await remindCompetitions(now);
  return { sessions, feedback, competitions };
}

module.exports = { runDaily, remindTodaySessions, remindMissingFeedback, remindCompetitions };
