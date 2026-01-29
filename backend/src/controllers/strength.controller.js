const StrengthSession = require('../models/strengthSession.model');
const PlannedRun = require('../models/plannedRun.model');

// Créer une séance de muscu
exports.createSession = async (req, res) => {
  try {
    const { date, duration, sessionType, exercises, notes, feeling, linkedPlannedSession } = req.body;

    const session = await StrengthSession.create({
      user: req.user._id,
      date: date || new Date(),
      duration,
      sessionType,
      exercises,
      notes,
      feeling,
      linkedPlannedSession
    });

    // Si liée à une séance planifiée, la marquer comme complétée
    if (linkedPlannedSession) {
      await PlannedRun.findByIdAndUpdate(linkedPlannedSession, {
        status: 'completed'
      });
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
    }).populate('exercises.exercise', 'name slug description imageUrl primaryMuscle muscleGroups equipment');

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
