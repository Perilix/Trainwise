const User = require('../models/user.model');
const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const Notification = require('../models/notification.model');
const ReengagementLog = require('../models/reengagementLog.model');
const { getIO, isUserOnline } = require('../socket/index');
const { sendPushNotification } = require('./pushNotification.service');

const DAY = 24 * 60 * 60 * 1000;

// Fenêtre temporelle [début, fin) en jours révolus par rapport à maintenant.
// daysAgoStart < daysAgoEnd. Ex: window(3, 4) = "il y a entre 3 et 4 jours".
function daysAgoWindow(daysAgoStart, daysAgoEnd, now) {
  return {
    $gte: new Date(now.getTime() - daysAgoEnd * DAY),
    $lt: new Date(now.getTime() - daysAgoStart * DAY)
  };
}

// Début du jour courant (pour l'anti-spam "1 relance / user / jour")
function startOfToday(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Sélection des destinataires par scénario ───────────────────────────────

// Inactif : dernière activité il y a 3–4 jours (fenêtre d'1 jour → 1 seul envoi)
async function findInactive(now) {
  const users = await User.find({
    pushToken: { $ne: null },
    'notificationPreferences.reengagement': { $ne: false },
    lastActivityAt: daysAgoWindow(3, 4, now)
  }).select('_id email firstName').lean();

  return users.map(u => ({
    user: u,
    type: 'inactive',
    title: `${u.firstName}, ça fait 3 jours 👀`,
    body: 'Une petite séance aujourd\'hui ? On garde le rythme 💪',
    actionUrl: '/dashboard'
  }));
}

// Streak en danger : dernière activité il y a 5–6 jours (règle simple demandée)
async function findStreakAtRisk(now) {
  const users = await User.find({
    pushToken: { $ne: null },
    'notificationPreferences.streak': { $ne: false },
    lastActivityAt: daysAgoWindow(5, 6, now)
  }).select('_id email firstName').lean();

  return users.map(u => ({
    user: u,
    type: 'streak',
    title: 'Ne casse pas ta série 🔥',
    body: 'Ça fait 5 jours… enregistre une séance pour garder ta streak !',
    actionUrl: '/dashboard'
  }));
}

// Onboarding incomplet : inscrit il y a 2–7 jours mais jamais aucune activité
async function findOnboardingIncomplete(now) {
  const users = await User.find({
    pushToken: { $ne: null },
    'notificationPreferences.onboarding': { $ne: false },
    lastActivityAt: null,
    createdAt: daysAgoWindow(2, 7, now)
  }).select('_id email firstName').lean();

  return users.map(u => ({
    user: u,
    type: 'onboarding',
    title: `Bienvenue ${u.firstName} ! 🏃`,
    body: 'Enregistre ta première séance pour lancer ton suivi.',
    actionUrl: '/dashboard'
  }));
}

// Récap hebdo : users actifs cette semaine, avec le total de km parcourus
async function findWeeklyRecap(now) {
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const users = await User.find({
    pushToken: { $ne: null },
    'notificationPreferences.weeklyRecap': { $ne: false },
    lastActivityAt: { $gte: weekAgo }
  }).select('_id email firstName').lean();

  // Totaux sur les 7 derniers jours, par utilisateur : km/sorties (Run) + séances muscu
  const userIds = users.map(u => u._id);
  const [runAgg, strengthAgg] = await Promise.all([
    Run.aggregate([
      { $match: { user: { $in: userIds }, date: { $gte: weekAgo } } },
      { $group: { _id: '$user', km: { $sum: '$distance' }, sessions: { $sum: 1 } } }
    ]),
    StrengthSession.aggregate([
      { $match: { user: { $in: userIds }, date: { $gte: weekAgo } } },
      { $group: { _id: '$user', sessions: { $sum: 1 } } }
    ])
  ]);
  const runsByUser = new Map(runAgg.map(a => [a._id.toString(), a]));
  const strengthByUser = new Map(strengthAgg.map(a => [a._id.toString(), a]));

  return users.map(u => {
    const r = runsByUser.get(u._id.toString());
    const km = Math.round((r?.km || 0) * 10) / 10;
    const sessions = r?.sessions || 0;
    const strengthCount = strengthByUser.get(u._id.toString())?.sessions || 0;

    const parts = [];
    if (km > 0) parts.push(`${km} km parcourus en ${sessions} sortie${sessions > 1 ? 's' : ''}`);
    if (strengthCount > 0) parts.push(`${strengthCount} séance${strengthCount > 1 ? 's' : ''} de muscu`);

    return {
      user: u,
      type: 'recap',
      title: 'Ton récap de la semaine 📊',
      body: parts.length > 0
        ? `${parts.join(' et ')}. Bravo, on continue ! 💪`
        : 'Une nouvelle semaine commence — fixe-toi un objectif 🎯',
      actionUrl: '/dashboard'
    };
  });
}

// ── Envoi + journalisation ─────────────────────────────────────────────────

// Envoie une relance : crée la notif in-app, envoie le push, et journalise le
// résultat par destinataire dans ReengagementLog.
async function sendOne(target) {
  const { user, type, title, body, actionUrl } = target;

  // 1) Notification in-app (centre de notifs)
  let notificationId = null;
  try {
    const notif = await Notification.create({
      recipient: user._id,
      type: 'reengagement',
      action: type,
      title,
      message: body,
      actionUrl
    });
    notificationId = notif._id.toString();

    const io = getIO();
    if (io) {
      io.to(`user:${user._id.toString()}`).emit('notification:new', notif);
    }
  } catch (e) {
    console.error('[reengagement] erreur création notif in-app:', e.message);
  }

  // 2) Push (toujours envoyé — la cible est par définition inactive)
  const pushResult = await sendPushNotification(user._id, {
    title,
    body,
    data: { type: 'reengagement', action: type, actionUrl: actionUrl || '/', notificationId: notificationId || '' }
  });

  // 3) Statut journalisé
  let status = 'sent';
  let error = null;
  if (!pushResult.success) {
    const err = typeof pushResult.error === 'string' ? pushResult.error : JSON.stringify(pushResult.error);
    status = err === 'No push token' ? 'no_token' : 'failed';
    error = status === 'failed' ? err : null;
  }

  await ReengagementLog.create({
    recipient: user._id,
    email: user.email,
    firstName: user.firstName,
    type,
    title,
    body,
    status,
    error
  });

  // 4) Anti-spam : mémorise la dernière relance
  await User.updateOne(
    { _id: user._id },
    { $set: { 'reengagement.lastSentAt': new Date(), 'reengagement.lastType': type } }
  );

  return status;
}

// Exécute une liste de scénarios, applique l'anti-spam (1 relance / user / jour,
// priorité dans l'ordre des scénarios fournis) et envoie.
async function runScenarios(scenarioFns, now = new Date()) {
  const todayStart = startOfToday(now);
  const alreadyTargeted = new Set();
  const summary = {};

  for (const fn of scenarioFns) {
    const targets = await fn(now);
    let sent = 0, failed = 0, noToken = 0, skipped = 0;

    for (const target of targets) {
      const uid = target.user._id.toString();

      // Déjà ciblé dans ce run ?
      if (alreadyTargeted.has(uid)) { skipped++; continue; }

      // Déjà reçu une relance aujourd'hui ? (anti-spam)
      const fresh = await User.findById(target.user._id).select('reengagement.lastSentAt').lean();
      const lastSent = fresh?.reengagement?.lastSentAt;
      if (lastSent && new Date(lastSent) >= todayStart) { skipped++; continue; }

      const status = await sendOne(target);
      alreadyTargeted.add(uid);
      if (status === 'sent') sent++;
      else if (status === 'no_token') noToken++;
      else failed++;
    }

    summary[targets[0]?.type || fn.name] = { total: targets.length, sent, failed, noToken, skipped };
  }

  return summary;
}

// Jobs prêts à l'emploi
async function runDaily(now = new Date()) {
  // Priorité : streak (urgent) > inactif > onboarding
  return runScenarios([findStreakAtRisk, findInactive, findOnboardingIncomplete], now);
}

async function runWeeklyRecap(now = new Date()) {
  return runScenarios([findWeeklyRecap], now);
}

module.exports = {
  runDaily,
  runWeeklyRecap,
  // exportés pour tests / déclenchement manuel
  findInactive,
  findStreakAtRisk,
  findOnboardingIncomplete,
  findWeeklyRecap,
  runScenarios
};
