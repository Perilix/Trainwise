const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const PlannedRun = require('../models/plannedRun.model');
const Run = require('../models/run.model');
const crypto = require('crypto');

// Générer un code d'invitation unique
const generateUniqueCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Obtenir la liste des athlètes du coach
exports.getAthletes = async (req, res) => {
  try {
    const relationships = await CoachAthlete.find({
      coach: req.user._id,
      status: 'accepted'
    }).populate('athlete', 'firstName lastName email profilePicture runningLevel goal');

    const athletes = relationships.map(rel => ({
      _id: rel.athlete._id,
      firstName: rel.athlete.firstName,
      lastName: rel.athlete.lastName,
      email: rel.athlete.email,
      profilePicture: rel.athlete.profilePicture,
      runningLevel: rel.athlete.runningLevel,
      goal: rel.athlete.goal,
      joinedAt: rel.respondedAt
    }));

    res.json(athletes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir les détails d'un athlète
exports.getAthleteById = async (req, res) => {
  try {
    const { athleteId } = req.params;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const athlete = await User.findById(athleteId).select('-password');

    // Calculer les stats récentes
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const weekRuns = await Run.find({
      user: athleteId,
      date: { $gte: weekStart }
    });

    const weeklyDistance = weekRuns.reduce((sum, r) => sum + (r.distance || 0), 0);
    const weeklyRuns = weekRuns.length;

    // Calculer le streak (simplifié)
    const recentRuns = await Run.find({ user: athleteId })
      .sort({ date: -1 })
      .limit(30);

    let streak = 0;
    const runDates = new Set(recentRuns.map(r =>
      new Date(r.date).toISOString().split('T')[0]
    ));

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (runDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    res.json({
      ...athlete.toObject(),
      recentStats: {
        weeklyDistance: Math.round(weeklyDistance * 10) / 10,
        weeklyRuns,
        streak
      },
      joinedAt: relationship.respondedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir le calendrier d'un athlète
exports.getAthleteCalendar = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { month, year } = req.query;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const [runs, plannedRuns] = await Promise.all([
      Run.find({
        user: athleteId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 }),
      PlannedRun.find({
        user: athleteId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 })
    ]);

    res.json({
      runs,
      plannedRuns,
      month: m,
      year: y
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir les séances planifiées d'un athlète
exports.getAthletePlanning = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { startDate, endDate, status } = req.query;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const query = { user: athleteId };

    if (startDate) {
      query.date = { $gte: new Date(startDate) };
    }
    if (endDate) {
      query.date = { ...query.date, $lte: new Date(endDate) };
    }
    if (status) {
      query.status = status;
    }

    const plannedRuns = await PlannedRun.find(query)
      .populate('linkedRun')
      .sort({ date: 1 });

    res.json(plannedRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Créer une séance pour un athlète
exports.createAthleteSession = async (req, res) => {
  try {
    const { athleteId } = req.params;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const plannedRun = await PlannedRun.create({
      ...req.body,
      user: athleteId,
      generatedBy: 'coach',
      createdBy: req.user._id
    });

    res.status(201).json(plannedRun);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Mettre à jour une séance d'un athlète
exports.updateAthleteSession = async (req, res) => {
  try {
    const { athleteId, planId } = req.params;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const plannedRun = await PlannedRun.findOneAndUpdate(
      { _id: planId, user: athleteId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    res.json(plannedRun);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Supprimer une séance d'un athlète
exports.deleteAthleteSession = async (req, res) => {
  try {
    const { athleteId, planId } = req.params;

    // Vérifier que l'athlète appartient au coach
    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'accepted'
    });

    if (!relationship) {
      return res.status(403).json({ error: 'Cet athlète ne fait pas partie de vos athlètes' });
    }

    const plannedRun = await PlannedRun.findOneAndDelete({
      _id: planId,
      user: athleteId
    });

    if (!plannedRun) {
      return res.status(404).json({ error: 'Séance non trouvée' });
    }

    res.json({ message: 'Séance supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Générer/régénérer le code d'invitation
exports.generateInviteCode = async (req, res) => {
  try {
    let code = generateUniqueCode();

    // S'assurer que le code est unique
    let existingUser = await User.findOne({ coachInviteCode: code });
    while (existingUser) {
      code = generateUniqueCode();
      existingUser = await User.findOne({ coachInviteCode: code });
    }

    await User.findByIdAndUpdate(req.user._id, { coachInviteCode: code });

    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir le code d'invitation actuel
exports.getInviteCode = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ code: user.coachInviteCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Envoyer une invitation directe
exports.sendDirectInvite = async (req, res) => {
  try {
    const { athleteId } = req.body;

    if (!athleteId) {
      return res.status(400).json({ error: 'ID de l\'athlète requis' });
    }

    // Vérifier que l'utilisateur existe et n'est pas un coach
    const athlete = await User.findById(athleteId);
    if (!athlete) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (athlete.role === 'coach') {
      return res.status(400).json({ error: 'Un coach ne peut pas être invité comme athlète' });
    }

    // Vérifier si l'athlète a déjà un coach
    const existingCoach = await CoachAthlete.findOne({
      athlete: athleteId,
      status: 'accepted'
    });

    if (existingCoach) {
      return res.status(400).json({ error: 'Cet athlète a déjà un coach' });
    }

    // Vérifier s'il y a déjà une invitation en attente
    const existingInvite = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: athleteId,
      status: 'pending'
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'Une invitation est déjà en attente pour cet athlète' });
    }

    // Créer l'invitation
    const invitation = await CoachAthlete.create({
      coach: req.user._id,
      athlete: athleteId,
      inviteMethod: 'direct'
    });

    const populatedInvitation = await CoachAthlete.findById(invitation._id)
      .populate('athlete', 'firstName lastName email profilePicture');

    res.status(201).json(populatedInvitation);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Une relation existe déjà avec cet athlète' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Obtenir les invitations en attente envoyées par le coach
exports.getPendingInvitations = async (req, res) => {
  try {
    const invitations = await CoachAthlete.find({
      coach: req.user._id,
      status: 'pending'
    }).populate('athlete', 'firstName lastName email profilePicture');

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Retirer un athlète
exports.removeAthlete = async (req, res) => {
  try {
    const { athleteId } = req.params;

    const result = await CoachAthlete.findOneAndDelete({
      coach: req.user._id,
      athlete: athleteId
    });

    if (!result) {
      return res.status(404).json({ error: 'Relation non trouvée' });
    }

    res.json({ message: 'Athlète retiré avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Rechercher des utilisateurs pour invitation
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      $and: [
        { role: { $ne: 'coach' } }, // Exclure les coachs
        { _id: { $ne: req.user._id } }, // Exclure soi-même
        {
          $or: [
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('firstName lastName email profilePicture')
    .limit(10);

    // Vérifier lesquels ont déjà une relation avec ce coach
    const athleteIds = users.map(u => u._id);
    const existingRelations = await CoachAthlete.find({
      coach: req.user._id,
      athlete: { $in: athleteIds }
    });

    const relationMap = {};
    existingRelations.forEach(rel => {
      relationMap[rel.athlete.toString()] = rel.status;
    });

    // Vérifier lesquels ont déjà un coach
    const existingCoaches = await CoachAthlete.find({
      athlete: { $in: athleteIds },
      status: 'accepted'
    });

    const hasCoachMap = {};
    existingCoaches.forEach(rel => {
      hasCoachMap[rel.athlete.toString()] = true;
    });

    const usersWithStatus = users.map(u => ({
      ...u.toObject(),
      relationStatus: relationMap[u._id.toString()] || null,
      hasCoach: hasCoachMap[u._id.toString()] || false
    }));

    res.json(usersWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Statistiques du coach
exports.getCoachStats = async (req, res) => {
  try {
    const [totalAthletes, pendingInvitations] = await Promise.all([
      CoachAthlete.countDocuments({ coach: req.user._id, status: 'accepted' }),
      CoachAthlete.countDocuments({ coach: req.user._id, status: 'pending' })
    ]);

    // Séances créées cette semaine
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const sessionsThisWeek = await PlannedRun.countDocuments({
      createdBy: req.user._id,
      createdAt: { $gte: weekStart }
    });

    // Total de séances créées
    const totalSessions = await PlannedRun.countDocuments({
      createdBy: req.user._id
    });

    res.json({
      totalAthletes,
      pendingInvitations,
      sessionsCreatedThisWeek: sessionsThisWeek,
      sessionsCreatedTotal: totalSessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
