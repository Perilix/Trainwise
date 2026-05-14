const axios = require('axios');
const StrengthSession = require('../models/strengthSession.model');
const PlannedRun = require('../models/plannedRun.model');
const User = require('../models/user.model');
const { autoCompletePlannedSessions } = require('../services/planningAutoComplete');
const { createNotification } = require('./notification.controller');
const { athleteHasCoach } = require('../services/coachRelation.service');

// Créer une séance de muscu
exports.createSession = async (req, res) => {
  try {
    const { date, duration, sessionType, exercises, notes, feeling, linkedPlannedSession, circuit, superset } = req.body;

    const session = await StrengthSession.create({
      user: req.user._id,
      date: date || new Date(),
      duration,
      sessionType,
      exercises,
      circuit,
      superset,
      notes,
      feeling,
      linkedPlannedSession
    });

    // Capture la séance planifiée (si présente) AVANT suppression pour notifier le coach
    let coachPlanned = null;
    if (linkedPlannedSession) {
      const planned = await PlannedRun.findOne({
        _id: linkedPlannedSession,
        user: req.user._id
      }).lean();
      if (planned?.generatedBy === 'coach' && planned.createdBy) {
        coachPlanned = planned;
      }
      await PlannedRun.findOneAndDelete({
        _id: linkedPlannedSession,
        user: req.user._id
      });
    } else {
      const matched = await autoCompletePlannedSessions(req.user._id, session.date, 'strength');
      coachPlanned = matched.find(p => p.generatedBy === 'coach' && p.createdBy) || null;
    }

    // Notifier le coach si la séance a été planifiée par lui
    if (coachPlanned) {
      try {
        const athleteUser = await User.findById(req.user._id).select('firstName lastName').lean();
        const athleteName = athleteUser ? `${athleteUser.firstName} ${athleteUser.lastName}` : 'Votre athlète';
        await createNotification({
          recipient: coachPlanned.createdBy,
          sender: req.user._id,
          type: 'session',
          action: 'session_completed',
          title: 'Séance muscu effectuée',
          message: `${athleteName} a effectué sa séance de musculation`,
          actionUrl: `/coach/athletes/${req.user._id}/muscu-detail/${session._id}?type=strength`
        });
      } catch (notifErr) {
        console.error('Erreur notif coach (muscu):', notifErr.message);
      }
    }

    // Populate les exercices pour la réponse
    await session.populate('exercises.exercise', 'name slug imageUrl primaryMuscle');

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating strength session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lister ses séances
exports.getSessions = async (req, res) => {
  try {
    const { startDate, endDate, sessionType, limit = 20, page = 1 } = req.query;

    const query = { user: req.user._id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (sessionType) {
      query.sessionType = sessionType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      StrengthSession.find(query)
        .populate('exercises.exercise', 'name slug imageUrl primaryMuscle')
        .populate('pendingPlannedMatch', 'date activityType sessionType description generatedBy')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StrengthSession.countDocuments(query)
    ]);

    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting strength sessions:', error);
    res.status(500).json({ error: error.message });
  }
};

// Détail d'une séance
exports.getSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await StrengthSession.findOne({
      _id: id,
      user: req.user._id
    })
      .populate('exercises.exercise', 'name slug description imageUrl primaryMuscle muscleGroups equipment')
      .populate('pendingPlannedMatch', 'date activityType sessionType description generatedBy');

    if (!session) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error getting strength session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Modifier une séance
exports.updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const session = await StrengthSession.findOneAndUpdate(
      { _id: id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    ).populate('exercises.exercise', 'name slug imageUrl primaryMuscle');

    if (!session) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error updating strength session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Analyser une séance de muscu avec l'IA
exports.analyzeSession = async (req, res) => {
  try {
    const session = await StrengthSession.findOne({ _id: req.params.id, user: req.user._id })
      .populate('exercises.exercise', 'name slug primaryMuscle muscleGroups equipment');
    if (!session) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    // Athlète coaché : pas d'analyse IA, c'est le coach qui assure le suivi
    if (await athleteHasCoach(req.user._id)) {
      return res.json(session);
    }

    const webhookUrl = process.env.N8N_STRENGTH_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook IA non configuré' });
    }

    const user = await User.findById(req.user._id);

    // 5 dernières séances muscu (hors celle-ci)
    const recentSessions = await StrengthSession.find({
      user: req.user._id,
      _id: { $ne: session._id }
    })
      .sort({ date: -1 })
      .limit(5)
      .populate('exercises.exercise', 'name primaryMuscle');

    // Dernière analyse muscu
    const lastAnalyzedSession = await StrengthSession.findOne({
      user: req.user._id,
      analysis: { $exists: true, $ne: null },
      _id: { $ne: session._id }
    }).sort({ analyzedAt: -1 });

    const enrichedContext = {
      type: 'strength',
      sessionId: session._id,
      currentSession: {
        date: session.date,
        sessionType: session.sessionType,
        duration: session.duration,
        feeling: session.feeling ?? null,
        notes: session.notes || null,
        totalSets: session.totalSets,
        totalReps: session.totalReps,
        totalVolume: session.totalVolume,
        exercises: session.exercises.map(e => ({
          name: e.exercise?.name,
          primaryMuscle: e.exercise?.primaryMuscle,
          equipment: e.exercise?.equipment,
          sets: e.sets,
          notes: e.notes
        }))
      },
      athlete: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.runningLevel,
        goal: user.goal,
        height: user.height || null,
        weight: user.weight || null,
        strengthFrequency: user.strengthFrequency || null,
        strengthGoal: user.strengthGoal || null,
        strengthType: user.strengthType || null,
        injuries: user.injuries || null
      },
      recentSessions: recentSessions.map(s => ({
        date: s.date,
        sessionType: s.sessionType,
        duration: s.duration,
        totalSets: s.totalSets,
        totalVolume: s.totalVolume,
        exercises: s.exercises.map(e => ({
          name: e.exercise?.name,
          sets: e.sets.length
        }))
      })),
      lastAnalysis: lastAnalyzedSession ? {
        date: lastAnalyzedSession.date,
        analysis: lastAnalyzedSession.analysis
      } : null
    };

    const response = await axios.post(webhookUrl, enrichedContext);

    if (response.data && response.data.analysis) {
      session.analysis = response.data.analysis;
      session.analyzedAt = new Date();
      await session.save();
    }

    res.json(session);
  } catch (error) {
    console.error('Error analyzing strength session:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Supprimer une séance
exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await StrengthSession.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!session) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    res.json({ message: 'Séance supprimée' });
  } catch (error) {
    console.error('Error deleting strength session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Stats de musculation
exports.getStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    // Calculer la date de début selon la période
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }

    const sessions = await StrengthSession.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: now }
    }).populate('exercises.exercise', 'primaryMuscle muscleGroups');

    // Calculs
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalSets = sessions.reduce((sum, s) => sum + s.totalSets, 0);
    const totalReps = sessions.reduce((sum, s) => sum + s.totalReps, 0);
    const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);

    // Fréquence par groupe musculaire
    const muscleFrequency = {};
    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        if (ex.exercise && ex.exercise.muscleGroups) {
          ex.exercise.muscleGroups.forEach(muscle => {
            muscleFrequency[muscle] = (muscleFrequency[muscle] || 0) + 1;
          });
        }
      });
    });

    // Fréquence par type de séance
    const sessionTypeFrequency = {};
    sessions.forEach(session => {
      sessionTypeFrequency[session.sessionType] = (sessionTypeFrequency[session.sessionType] || 0) + 1;
    });

    res.json({
      period,
      startDate,
      endDate: now,
      stats: {
        totalSessions,
        totalDuration,
        totalSets,
        totalReps,
        totalVolume,
        avgSessionDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
        avgSetsPerSession: totalSessions > 0 ? Math.round(totalSets / totalSessions) : 0
      },
      muscleFrequency,
      sessionTypeFrequency
    });
  } catch (error) {
    console.error('Error getting strength stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Types de séances disponibles
exports.getSessionTypes = async (req, res) => {
  const sessionTypes = [
    { value: 'upper_body', label: 'Haut du corps' },
    { value: 'lower_body', label: 'Bas du corps' },
    { value: 'full_body', label: 'Corps complet' },
    { value: 'push', label: 'Push (Poussée)' },
    { value: 'pull', label: 'Pull (Tirage)' },
    { value: 'legs', label: 'Jambes' },
    { value: 'core', label: 'Abdos / Core' },
    { value: 'hiit', label: 'HIIT' },
    { value: 'other', label: 'Autre' }
  ];

  res.json(sessionTypes);
};
