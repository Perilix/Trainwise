const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const PlannedRun = require('../models/plannedRun.model');
const User = require('../models/user.model');
const { createNotification } = require('./notification.controller');
const { mapRunBlockPlain } = require('../utils/runBlockMapper');

const CANDIDATE_WINDOW_DAYS = 3;

function buildPlannedSnapshot(planned) {
  return {
    sessionType: planned.sessionType,
    targetDistance: planned.targetDistance,
    targetDuration: planned.targetDuration,
    targetPace: planned.targetPace,
    description: planned.description,
    // mapRunBlockPlain préserve les groupes « Répéter » (children)
    runBlocks: (planned.runBlocks || []).map(mapRunBlockPlain),
    coach: planned.createdBy || null
  };
}

async function notifyCoachIfNeeded(planned, athleteId, activityId, kind) {
  if (planned.generatedBy !== 'coach' || !planned.createdBy) return;
  try {
    const athleteUser = await User.findById(athleteId).select('firstName lastName').lean();
    const athleteName = athleteUser ? `${athleteUser.firstName} ${athleteUser.lastName}` : 'Votre athlète';
    const isStrength = kind === 'strength';
    await createNotification({
      recipient: planned.createdBy,
      sender: athleteId,
      type: 'session',
      action: 'session_completed',
      title: isStrength ? 'Séance muscu effectuée' : 'Séance effectuée',
      message: isStrength
        ? `${athleteName} a effectué sa séance de musculation`
        : `${athleteName} a effectué sa séance`,
      actionUrl: isStrength
        ? `/coach/athletes/${athleteId}/muscu-detail/${activityId}?type=strength`
        : `/coach/athletes/${athleteId}/run/${activityId}`
    });
  } catch (e) {
    console.error('Erreur notif coach (match):', e.message);
  }
}

function candidateQuery(userId, activityDate, activityType) {
  const d = new Date(activityDate);
  const from = new Date(d);
  from.setUTCDate(from.getUTCDate() - CANDIDATE_WINDOW_DAYS);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(d);
  to.setUTCDate(to.getUTCDate() + CANDIDATE_WINDOW_DAYS);
  to.setUTCHours(23, 59, 59, 999);

  const typeConditions = activityType === 'running'
    ? [{ activityType: 'running' }, { activityType: { $exists: false } }, { activityType: null }]
    : [{ activityType }];

  return {
    user: userId,
    date: { $gte: from, $lte: to },
    $and: [
      { $or: typeConditions },
      // Une séance sautée automatiquement (job quotidien) reste rattrapable
      { $or: [{ status: 'planned' }, { status: 'skipped', autoSkipped: true }] }
    ]
  };
}

// ──────────────── RUNS ────────────────

async function loadRun(id, userId) {
  return Run.findOne({ _id: id, user: userId });
}

exports.getRunMatchCandidates = async (req, res) => {
  try {
    const run = await loadRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ error: 'Course non trouvée' });

    const candidates = await PlannedRun.find(candidateQuery(req.user._id, run.date, 'running'))
      .sort({ date: 1 })
      .lean();
    res.json(candidates);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function attachPlannedToRun(run, planned, athleteId) {
  run.plannedSnapshot = buildPlannedSnapshot(planned);
  run.pendingPlannedMatch = null;
  run.matchDismissed = true;
  await run.save();
  await PlannedRun.deleteOne({ _id: planned._id });
  await notifyCoachIfNeeded(planned, athleteId, run._id, 'run');
}

exports.confirmRunMatch = async (req, res) => {
  try {
    const run = await loadRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ error: 'Course non trouvée' });
    if (!run.pendingPlannedMatch) {
      return res.status(400).json({ error: 'Aucune suggestion de match en attente' });
    }

    const planned = await PlannedRun.findOne({ _id: run.pendingPlannedMatch, user: req.user._id }).lean();
    if (!planned) {
      run.pendingPlannedMatch = null;
      await run.save();
      return res.status(404).json({ error: 'Séance planifiée introuvable' });
    }

    await attachPlannedToRun(run, planned, req.user._id);
    res.json(run);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.dismissRunMatch = async (req, res) => {
  try {
    const run = await loadRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ error: 'Course non trouvée' });
    run.pendingPlannedMatch = null;
    run.matchDismissed = true;
    await run.save();
    res.json(run);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.linkRunToPlanned = async (req, res) => {
  try {
    const run = await loadRun(req.params.id, req.user._id);
    if (!run) return res.status(404).json({ error: 'Course non trouvée' });

    const planned = await PlannedRun.findOne({ _id: req.params.plannedId, user: req.user._id }).lean();
    if (!planned) return res.status(404).json({ error: 'Séance planifiée introuvable' });

    await attachPlannedToRun(run, planned, req.user._id);
    res.json(run);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ──────────────── STRENGTH ────────────────

async function loadStrength(id, userId) {
  return StrengthSession.findOne({ _id: id, user: userId });
}

exports.getStrengthMatchCandidates = async (req, res) => {
  try {
    const session = await loadStrength(req.params.id, req.user._id);
    if (!session) return res.status(404).json({ error: 'Séance non trouvée' });

    const candidates = await PlannedRun.find(candidateQuery(req.user._id, session.date, 'strength'))
      .sort({ date: 1 })
      .lean();
    res.json(candidates);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

async function attachPlannedToStrength(session, planned, athleteId) {
  session.linkedPlannedSession = planned._id;
  session.pendingPlannedMatch = null;
  session.matchDismissed = true;
  await session.save();
  await PlannedRun.deleteOne({ _id: planned._id });
  await notifyCoachIfNeeded(planned, athleteId, session._id, 'strength');
}

exports.confirmStrengthMatch = async (req, res) => {
  try {
    const session = await loadStrength(req.params.id, req.user._id);
    if (!session) return res.status(404).json({ error: 'Séance non trouvée' });
    if (!session.pendingPlannedMatch) {
      return res.status(400).json({ error: 'Aucune suggestion de match en attente' });
    }

    const planned = await PlannedRun.findOne({ _id: session.pendingPlannedMatch, user: req.user._id }).lean();
    if (!planned) {
      session.pendingPlannedMatch = null;
      await session.save();
      return res.status(404).json({ error: 'Séance planifiée introuvable' });
    }

    await attachPlannedToStrength(session, planned, req.user._id);
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.dismissStrengthMatch = async (req, res) => {
  try {
    const session = await loadStrength(req.params.id, req.user._id);
    if (!session) return res.status(404).json({ error: 'Séance non trouvée' });
    session.pendingPlannedMatch = null;
    session.matchDismissed = true;
    await session.save();
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.linkStrengthToPlanned = async (req, res) => {
  try {
    const session = await loadStrength(req.params.id, req.user._id);
    if (!session) return res.status(404).json({ error: 'Séance non trouvée' });

    const planned = await PlannedRun.findOne({ _id: req.params.plannedId, user: req.user._id }).lean();
    if (!planned) return res.status(404).json({ error: 'Séance planifiée introuvable' });

    await attachPlannedToStrength(session, planned, req.user._id);
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
