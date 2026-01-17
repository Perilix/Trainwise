const axios = require('axios');
const PlannedRun = require('../models/plannedRun.model');
const Run = require('../models/run.model');
const User = require('../models/user.model');

// Récupérer toutes les séances planifiées de l'utilisateur
exports.getPlannedRuns = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const query = { user: req.user._id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (status) {
      query.status = status;
    }

    const plannedRuns = await PlannedRun.find(query)
      .sort({ date: 1 })
      .populate('linkedRun');

    res.json(plannedRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupérer une séance planifiée par ID
exports.getPlannedRunById = async (req, res) => {
  try {
    const plannedRun = await PlannedRun.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('linkedRun');

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance planifiée non trouvée' });
    }

    res.json(plannedRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Créer une séance planifiée manuellement
exports.createPlannedRun = async (req, res) => {
  try {
    const plannedRun = new PlannedRun({
      ...req.body,
      user: req.user._id,
      generatedBy: 'manual'
    });

    await plannedRun.save();
    res.status(201).json(plannedRun);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Mettre à jour une séance planifiée
exports.updatePlannedRun = async (req, res) => {
  try {
    const plannedRun = await PlannedRun.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance planifiée non trouvée' });
    }

    res.json(plannedRun);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Supprimer une séance planifiée
exports.deletePlannedRun = async (req, res) => {
  try {
    const plannedRun = await PlannedRun.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance planifiée non trouvée' });
    }

    res.json({ message: 'Séance supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marquer une séance comme complétée ou skippée
exports.updateStatus = async (req, res) => {
  try {
    const { status, linkedRunId } = req.body;

    if (!['completed', 'skipped', 'planned'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const updateData = { status };
    if (linkedRunId) {
      updateData.linkedRun = linkedRunId;
    }

    const plannedRun = await PlannedRun.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true }
    ).populate('linkedRun');

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance planifiée non trouvée' });
    }

    res.json(plannedRun);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Générer un plan d'entraînement via IA
exports.generatePlan = async (req, res) => {
  try {
    const { weeks = 1 } = req.body;

    // Récupérer le profil utilisateur
    const user = await User.findById(req.user._id);

    if (!user.availableDays || user.availableDays.length === 0) {
      return res.status(400).json({
        error: 'Configure tes jours disponibles dans ton profil avant de générer un plan'
      });
    }

    // Récupérer l'historique récent
    const recentRuns = await Run.find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(10);

    // Stats des 4 dernières semaines
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const monthRuns = await Run.find({
      user: req.user._id,
      date: { $gte: fourWeeksAgo }
    });

    const totalDistance = monthRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const weeklyAvgDistance = totalDistance / 4;

    // Dernière analyse IA
    const lastAnalyzedRun = await Run.findOne({
      user: req.user._id,
      analysis: { $exists: true, $ne: null }
    }).sort({ analyzedAt: -1 });

    // Séances déjà planifiées (pour éviter les doublons)
    const existingPlanned = await PlannedRun.find({
      user: req.user._id,
      status: 'planned',
      date: { $gte: new Date() }
    });

    // Construire le contexte pour l'IA
    const planningContext = {
      runner: {
        name: `${user.firstName} ${user.lastName}`,
        level: user.runningLevel,
        goal: user.goal,
        goalDetails: user.goalDetails,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries,
        availableDays: user.availableDays,
        preferredTime: user.preferredTime
      },
      history: {
        recentRuns: recentRuns.map(r => ({
          date: r.date,
          distance: r.distance,
          duration: r.duration,
          sessionType: r.sessionType,
          feeling: r.feeling
        })),
        weeklyAvgDistance: Math.round(weeklyAvgDistance * 10) / 10,
        totalRunsLast4Weeks: monthRuns.length
      },
      lastAnalysis: lastAnalyzedRun?.analysis || null,
      existingPlannedDates: existingPlanned.map(p => p.date.toISOString().split('T')[0]),
      weeksToGenerate: weeks,
      today: new Date().toISOString().split('T')[0]
    };

    // Appeler le webhook n8n pour la génération du plan
    if (!process.env.N8N_PLANNING_WEBHOOK_URL) {
      return res.status(500).json({
        error: 'Webhook de planification non configuré'
      });
    }

    const response = await axios.post(process.env.N8N_PLANNING_WEBHOOK_URL, planningContext);

    if (!response.data || !response.data.sessions) {
      return res.status(500).json({ error: 'Erreur lors de la génération du plan' });
    }

    // Créer les séances planifiées
    const createdSessions = [];
    for (const session of response.data.sessions) {
      const plannedRun = new PlannedRun({
        user: req.user._id,
        date: new Date(session.date),
        sessionType: session.sessionType,
        targetDistance: session.targetDistance,
        targetDuration: session.targetDuration,
        targetPace: session.targetPace,
        description: session.description,
        warmup: session.warmup,
        mainWorkout: session.mainWorkout,
        cooldown: session.cooldown,
        weekNumber: session.weekNumber,
        generatedBy: 'ai'
      });

      await plannedRun.save();
      createdSessions.push(plannedRun);
    }

    res.status(201).json({
      message: `${createdSessions.length} séances générées`,
      sessions: createdSessions
    });
  } catch (error) {
    console.error('Planning generation error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Récupérer les données du calendrier (runs + planned)
exports.getCalendarData = async (req, res) => {
  try {
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Récupérer les courses effectuées
    const runs = await Run.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Récupérer les séances planifiées
    const plannedRuns = await PlannedRun.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    res.json({
      runs,
      plannedRuns,
      month: parseInt(month),
      year: parseInt(year)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
