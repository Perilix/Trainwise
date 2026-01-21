const axios = require('axios');
const Run = require('../models/run.model');
const User = require('../models/user.model');

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

    // Appeler n8n pour l'analyse si le webhook est configuré
    if (process.env.N8N_WEBHOOK_URL) {
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
            goal: user.goal,
            goalDetails: user.goalDetails,
            weeklyFrequency: user.weeklyFrequency,
            injuries: user.injuries
          },

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

    res.status(201).json(run);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Récupérer toutes les courses de l'utilisateur connecté
exports.getAllRuns = async (req, res) => {
  try {
    const runs = await Run.find({ user: req.user._id }).sort({ date: -1 });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupérer une course par ID (appartenant à l'utilisateur)
exports.getRunById = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id });
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

    if (!process.env.N8N_WEBHOOK_URL) {
      return res.status(400).json({ error: 'Webhook IA non configuré' });
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
        feeling: run.feeling,
        notes: run.notes
      },
      runner: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: user.runningLevel,
        goal: user.goal,
        goalDetails: user.goalDetails,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries
      },
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

    const response = await axios.post(process.env.N8N_WEBHOOK_URL, enrichedContext);

    if (response.data && response.data.analysis) {
      run.analysis = response.data.analysis;
      run.analyzedAt = new Date();
      await run.save();
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
