const axios = require('axios');
const Run = require('../models/run.model');
const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const { autoCompletePlannedSessions } = require('../services/planningAutoComplete');
const { createNotification } = require('./notification.controller');
const { athleteHasCoach } = require('../services/coachRelation.service');
const { getUpcomingCompetitionsForContext } = require('../utils/competitions');
const { mapRunBlockPlain } = require('../utils/runBlockMapper');
const aiAnalysis = require('../services/aiAnalysis.service');
const { getIO } = require('../socket/index');

// Helper: Calculer les statistiques des courses récentes
const calculateStats = (runs) => {
  if (!runs || runs.length === 0) {
    return null;
  }

  const totalDistance = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
  const totalDuration = runs.reduce((sum, run) => sum + (run.duration || 0), 0);
  const avgFeeling = runs.filter(r => r.feeling).reduce((sum, run, _, arr) => sum + run.feeling / arr.length, 0);

  // Calculer l'allure moyenne
  const runsWithPace = runs.filter(r => r.distance && r.duration);
  let avgPace = null;
  if (runsWithPace.length > 0) {
    const totalPaceMinutes = runsWithPace.reduce((sum, run) => {
      return sum + (run.duration / run.distance);
    }, 0);
    const avgPaceMinutes = totalPaceMinutes / runsWithPace.length;
    const paceMin = Math.floor(avgPaceMinutes);
    const paceSec = Math.round((avgPaceMinutes - paceMin) * 60);
    avgPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
  }

  // Jours depuis la dernière sortie
  const lastRunDate = runs[0]?.date;
  const daysSinceLastRun = lastRunDate
    ? Math.floor((new Date() - new Date(lastRunDate)) / (1000 * 60 * 60 * 24))
    : null;

  return {
    totalRuns: runs.length,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.round(totalDuration),
    avgFeeling: avgFeeling ? Math.round(avgFeeling * 10) / 10 : null,
    avgPace,
    daysSinceLastRun
  };
};

// Helper: Formater les courses pour le contexte
const formatRunsForContext = (runs) => {
  return runs.map(run => ({
    date: run.date,
    distance: run.distance,
    duration: run.duration,
    averagePace: run.averagePace,
    sessionType: run.sessionType,
    feeling: run.feeling,
    notes: run.notes
  }));
};

// Créer une nouvelle course et demander l'analyse
exports.createRun = async (req, res) => {
  try {
    const run = new Run({
      ...req.body,
      user: req.user._id
    });
    await run.save();

    // Marque la dernière activité (pour le ciblage des relances de ré-engagement)
    await User.updateOne({ _id: req.user._id }, { $set: { lastActivityAt: new Date() } });

    // Auto-update FCmax si la séance dépasse la valeur enregistrée
    if (run.maxHeartRate) {
      await User.updateOne(
        { _id: req.user._id, $or: [{ fcmax: null }, { fcmax: { $lt: run.maxHeartRate } }] },
        { $set: { fcmax: run.maxHeartRate } }
      );
    }

    // Compléter automatiquement les séances planifiées du même jour
    // Récupère les séances effacées pour : (1) figer un snapshot dans le Run, (2) notifier le coach
    const matchedPlanned = await autoCompletePlannedSessions(req.user._id, run.date, 'running');
    const coachPlanned = matchedPlanned.find(p => p.generatedBy === 'coach' && p.createdBy);

    if (coachPlanned) {
      // Snapshot figé de ce que le coach avait prévu
      run.plannedSnapshot = {
        title: coachPlanned.title || null,
        sessionType: coachPlanned.sessionType,
        targetDistance: coachPlanned.targetDistance,
        targetDuration: coachPlanned.targetDuration,
        targetPace: coachPlanned.targetPace,
        description: coachPlanned.description,
        runBlocks: (coachPlanned.runBlocks || []).map(mapRunBlockPlain),
        coach: coachPlanned.createdBy
      };
      await run.save();

      // Notifier le coach
      try {
        const athleteUser = await User.findById(req.user._id).select('firstName lastName').lean();
        const athleteName = athleteUser ? `${athleteUser.firstName} ${athleteUser.lastName}` : 'Votre athlète';
        await createNotification({
          recipient: coachPlanned.createdBy,
          sender: req.user._id,
          type: 'session',
          action: 'session_completed',
          title: 'Séance effectuée',
          message: `${athleteName} a effectué sa séance`,
          actionUrl: `/coach/athletes/${req.user._id}/run/${run._id}`
        });
      } catch (notifErr) {
        console.error('Erreur notif coach:', notifErr.message);
      }
    }

    // Athlète coaché : skip toutes les analyses IA, le coach prend le relais
    const skipAI = await athleteHasCoach(req.user._id);

    // Appeler n8n pour l'analyse si le webhook est configuré
    if (!skipAI && process.env.N8N_WEBHOOK_URL) {
      try {
        // Récupérer les données utilisateur complètes
        const user = await User.findById(req.user._id);

        // Récupérer les 5 dernières courses (excluant celle qu'on vient de créer)
        const recentRuns = await Run.find({
          user: req.user._id,
          _id: { $ne: run._id }
        })
          .sort({ date: -1 })
          .limit(5);

        // Trouver la dernière analyse
        const lastAnalyzedRun = await Run.findOne({
          user: req.user._id,
          analysis: { $exists: true, $ne: null },
          _id: { $ne: run._id }
        }).sort({ analyzedAt: -1 });

        // Calculer les stats sur les 2 dernières semaines
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const twoWeeksRuns = await Run.find({
          user: req.user._id,
          date: { $gte: twoWeeksAgo },
          _id: { $ne: run._id }
        }).sort({ date: -1 });

        const stats = calculateStats(twoWeeksRuns);
        const upcomingCompetitions = await getUpcomingCompetitionsForContext(req.user._id);

        // Construire le contexte enrichi
        const enrichedContext = {
          // Données de la course actuelle
          runId: run._id,
          currentRun: {
            date: run.date,
            distance: run.distance,
            duration: run.duration,
            averagePace: run.averagePace,
            averageHeartRate: run.averageHeartRate,
            maxHeartRate: run.maxHeartRate,
            averageCadence: run.averageCadence,
            elevationGain: run.elevationGain,
            sessionType: run.sessionType,
            feeling: run.feeling,
            notes: run.notes
          },

          // Profil coureur
          runner: {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            level: user.runningLevel,
            weeklyFrequency: user.weeklyFrequency,
            injuries: user.injuries,
            strengthFrequency: user.strengthFrequency,
            strengthGoal: user.strengthGoal,
            strengthType: user.strengthType
          },

          // Prochaines compétitions (objectifs)
          upcomingCompetitions,

          // Historique récent
          recentRuns: formatRunsForContext(recentRuns),

          // Dernière analyse IA
          lastAnalysis: lastAnalyzedRun ? {
            date: lastAnalyzedRun.date,
            analysis: lastAnalyzedRun.analysis,
            runSummary: {
              distance: lastAnalyzedRun.distance,
              duration: lastAnalyzedRun.duration,
              sessionType: lastAnalyzedRun.sessionType
            }
          } : null,

          // Statistiques 2 dernières semaines
          twoWeeksStats: stats,

          // Contexte temporel
          context: {
            dayOfWeek: new Date().toLocaleDateString('fr-FR', { weekday: 'long' }),
            isWeekend: [0, 6].includes(new Date().getDay())
          }
        };

        const response = await axios.post(process.env.N8N_WEBHOOK_URL, enrichedContext);

        // Mettre à jour avec l'analyse reçue
        if (response.data && response.data.analysis) {
          run.analysis = response.data.analysis;
          run.analyzedAt = new Date();
          await run.save();
        }
      } catch (webhookError) {
        console.error('N8N webhook error:', webhookError.message);
      }
    }

    // Analyse qualitative basée sur les blocs (si présents) : API Claude en direct, fallback n8n
    const hasBlocks = (run.runBlocks?.length || run.plannedSnapshot?.runBlocks?.length);
    if (!skipAI && (aiAnalysis.isConfigured() || process.env.N8N_BLOCKS_WEBHOOK_URL) && hasBlocks) {
      try {
        const user = await User.findById(req.user._id);

        const recentRuns = await Run.find({
          user: req.user._id,
          _id: { $ne: run._id }
        }).sort({ date: -1 }).limit(5);

        const lastAnalyzedRun = await Run.findOne({
          user: req.user._id,
          analysis: { $exists: true, $ne: null },
          _id: { $ne: run._id }
        }).sort({ analyzedAt: -1 });

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const twoWeeksRuns = await Run.find({
          user: req.user._id,
          date: { $gte: twoWeeksAgo },
          _id: { $ne: run._id }
        }).sort({ date: -1 });
        const stats = calculateStats(twoWeeksRuns);
        const upcomingCompetitions = await getUpcomingCompetitionsForContext(req.user._id);

        const blocksContext = {
          runId: run._id,
          currentRun: {
            date: run.date,
            distance: run.distance,
            duration: run.duration,
            averagePace: run.averagePace,
            averageHeartRate: run.averageHeartRate,
            maxHeartRate: run.maxHeartRate,
            averageCadence: run.averageCadence,
            elevationGain: run.elevationGain,
            sessionType: run.sessionType,
            feeling: run.feeling,
            notes: run.notes,
            // Blocs réalisés par l'athlète
            runBlocks: (run.runBlocks || []).map(mapRunBlockPlain)
          },
          // Plan figé du coach (s'il existe)
          coachPlan: run.plannedSnapshot && run.plannedSnapshot.coach ? {
            sessionType: run.plannedSnapshot.sessionType,
            targetDistance: run.plannedSnapshot.targetDistance,
            targetDuration: run.plannedSnapshot.targetDuration,
            targetPace: run.plannedSnapshot.targetPace,
            description: run.plannedSnapshot.description,
            runBlocks: (run.plannedSnapshot.runBlocks || []).map(mapRunBlockPlain),
            coachId: run.plannedSnapshot.coach
          } : null,
          runner: {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            level: user.runningLevel,
            weeklyFrequency: user.weeklyFrequency,
            injuries: user.injuries,
            height: user.height || null,
            weight: user.weight || null,
            vma: user.vma || null,
            fcmax: user.fcmax || null,
            strengthFrequency: user.strengthFrequency,
            strengthGoal: user.strengthGoal,
            strengthType: user.strengthType
          },
          upcomingCompetitions,
          recentRuns: formatRunsForContext(recentRuns),
          lastAnalysis: lastAnalyzedRun ? {
            date: lastAnalyzedRun.date,
            analysis: lastAnalyzedRun.analysis,
            runSummary: {
              distance: lastAnalyzedRun.distance,
              duration: lastAnalyzedRun.duration,
              sessionType: lastAnalyzedRun.sessionType
            }
          } : null,
          twoWeeksStats: stats,
          context: {
            dayOfWeek: new Date(run.date).toLocaleDateString('fr-FR', { weekday: 'long' }),
            isWeekend: [0, 6].includes(new Date(run.date).getDay()),
            hasCoachPlan: !!(run.plannedSnapshot && run.plannedSnapshot.coach)
          }
        };

        if (aiAnalysis.isConfigured()) {
          const analysis = await aiAnalysis.analyzeRun(blocksContext);
          run.analysis = analysis;
          run.analyzedAt = new Date();
          await run.save();
        } else {
          const blocksResponse = await axios.post(process.env.N8N_BLOCKS_WEBHOOK_URL, blocksContext);
          if (blocksResponse.data && blocksResponse.data.analysis) {
            run.analysis = blocksResponse.data.analysis;
            run.analyzedAt = new Date();
            await run.save();
          }
        }
      } catch (blocksWebhookError) {
        console.error('Blocks analysis error:', blocksWebhookError.message);
      }
    }

    res.status(201).json(run);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const PENDING_MATCH_FIELDS = 'date activityType sessionType targetDistance targetDuration targetPace description generatedBy';

// Récupérer toutes les courses de l'utilisateur connecté
exports.getAllRuns = async (req, res) => {
  try {
    const runs = await Run.find({ user: req.user._id })
      .populate('pendingPlannedMatch', PENDING_MATCH_FIELDS)
      .sort({ date: -1 });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupérer une course par ID (appartenant à l'utilisateur)
exports.getRunById = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id })
      .populate('pendingPlannedMatch', PENDING_MATCH_FIELDS);
    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Analyser une course existante avec l'IA
exports.analyzeRun = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id });
    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }

    // Athlète coaché : pas d'analyse IA, c'est le coach qui assure le suivi
    if (await athleteHasCoach(req.user._id)) {
      return res.json(run);
    }

    if (!aiAnalysis.isConfigured() && !process.env.N8N_WEBHOOK_URL) {
      return res.status(400).json({ error: 'Analyse IA non configurée' });
    }

    // Récupérer les données utilisateur complètes
    const user = await User.findById(req.user._id);

    // Récupérer les 5 dernières courses (excluant celle-ci)
    const recentRuns = await Run.find({
      user: req.user._id,
      _id: { $ne: run._id }
    })
      .sort({ date: -1 })
      .limit(5);

    // Trouver la dernière analyse
    const lastAnalyzedRun = await Run.findOne({
      user: req.user._id,
      analysis: { $exists: true, $ne: null },
      _id: { $ne: run._id }
    }).sort({ analyzedAt: -1 });

    // Calculer les stats sur les 2 dernières semaines
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const twoWeeksRuns = await Run.find({
      user: req.user._id,
      date: { $gte: twoWeeksAgo },
      _id: { $ne: run._id }
    }).sort({ date: -1 });

    const stats = calculateStats(twoWeeksRuns);
    const upcomingCompetitions = await getUpcomingCompetitionsForContext(req.user._id);

    // Construire le contexte enrichi
    const enrichedContext = {
      runId: run._id,
      currentRun: {
        date: run.date,
        distance: run.distance,
        duration: run.duration,
        averagePace: run.averagePace,
        averageHeartRate: run.averageHeartRate,
        maxHeartRate: run.maxHeartRate,
        averageCadence: run.averageCadence,
        elevationGain: run.elevationGain,
        sessionType: run.sessionType,
        feeling: run.feeling ?? null,
        notes: run.notes || null
      },
      runner: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.runningLevel,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries || null,
        height: user.height || null,
        weight: user.weight || null,
        vma: user.vma || null,
        fcmax: user.fcmax || null,
        strengthFrequency: user.strengthFrequency || null,
        strengthGoal: user.strengthGoal || null,
        strengthType: user.strengthType || null
      },
      upcomingCompetitions,
      recentRuns: formatRunsForContext(recentRuns),
      lastAnalysis: lastAnalyzedRun ? {
        date: lastAnalyzedRun.date,
        analysis: lastAnalyzedRun.analysis,
        runSummary: {
          distance: lastAnalyzedRun.distance,
          duration: lastAnalyzedRun.duration,
          sessionType: lastAnalyzedRun.sessionType
        }
      } : null,
      twoWeeksStats: stats,
      context: {
        dayOfWeek: new Date(run.date).toLocaleDateString('fr-FR', { weekday: 'long' }),
        isWeekend: [0, 6].includes(new Date(run.date).getDay())
      }
    };

    // API Claude en direct (prioritaire), fallback webhook n8n legacy
    if (aiAnalysis.isConfigured()) {
      const userId = String(req.user._id);
      const analysis = await aiAnalysis.analyzeRun(enrichedContext, (percent) => {
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('analysis:progress', { targetId: String(run._id), percent });
      });
      run.analysis = analysis;
      run.analyzedAt = new Date();
      await run.save();
    } else {
      const response = await axios.post(process.env.N8N_WEBHOOK_URL, enrichedContext);
      if (response.data && response.data.analysis) {
        run.analysis = response.data.analysis;
        run.analyzedAt = new Date();
        await run.save();
      }
    }

    res.json(run);
  } catch (error) {
    console.error('Analyze run error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Mettre à jour l'analyse (appelé par n8n en callback)
exports.updateAnalysis = async (req, res) => {
  try {
    const run = await Run.findByIdAndUpdate(
      req.params.id,
      {
        analysis: req.body.analysis,
        analyzedAt: new Date()
      },
      { new: true }
    );

    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }

    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mettre à jour une course (feeling, notes, blocs, etc.)
exports.updateRun = async (req, res) => {
  try {
    const allowed = ['feeling', 'notes', 'sessionType', 'runBlocks'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Dès que l'athlète édite ses blocs, ils ne sont plus "auto" → le resync ne les écrasera plus
    if (req.body.runBlocks !== undefined) updates.blocksAutoReconstructed = false;

    const run = await Run.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true }
    );

    if (!run) return res.status(404).json({ error: 'Course non trouvée' });

    // Si l'athlète a édité ses blocs et a un coach, notifier le coach
    if (req.body.runBlocks !== undefined) {
      try {
        const relationship = await CoachAthlete.findOne({
          athlete: req.user._id,
          status: 'accepted'
        }).select('coach').lean();
        if (relationship?.coach) {
          const athleteUser = await User.findById(req.user._id).select('firstName lastName').lean();
          const athleteName = athleteUser ? `${athleteUser.firstName} ${athleteUser.lastName}` : 'Votre athlète';
          await createNotification({
            recipient: relationship.coach,
            sender: req.user._id,
            type: 'session',
            action: 'session_completed',
            title: 'Séance détaillée',
            message: `${athleteName} a détaillé sa séance`,
            actionUrl: `/coach/athletes/${req.user._id}/run/${run._id}`
          });
        }
      } catch (notifErr) {
        console.error('Erreur notif coach (blocs):', notifErr.message);
      }
    }

    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Supprimer une course
exports.deleteRun = async (req, res) => {
  try {
    const run = await Run.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }

    res.json({ message: 'Course supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
