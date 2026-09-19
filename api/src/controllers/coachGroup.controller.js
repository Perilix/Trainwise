const CoachAthlete = require('../models/coachAthlete.model');
const CoachGroup = require('../models/coachGroup.model');
const { groupRoom } = require('../services/coachPlan.service');

// Ce que l'app affiche d'un membre : de quoi dessiner une pastille et un nom.
const ATHLETE_FIELDS = 'firstName lastName email profilePicture';

/** Les athlètes réellement suivis par ce coach : un groupe ne peut contenir qu'eux. */
const followedIds = async (coachId) => {
  const links = await CoachAthlete.find({ coach: coachId, status: 'accepted' }).select('athlete').lean();
  return new Set(links.map((link) => link.athlete.toString()));
};

/** Garde les identifiants envoyés qui correspondent à des athlètes suivis, sans doublon. */
const keepFollowed = (raw, allowed) => {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : [])
    .map(String)
    .filter((id) => allowed.has(id) && !seen.has(id) && seen.add(id));
};

const COLORS = ['bleu', 'indigo', 'turquoise', 'rose', 'sable', 'ardoise'];
const keepColor = (raw) => (COLORS.includes(raw) ? raw : 'bleu');

const shape = (group) => ({
  id: group._id,
  name: group.name,
  color: group.color || 'bleu',
  race: group.race?.name ? { name: group.race.name, date: group.race.date } : null,
  athletes: (group.athletes || []).map((athlete) => ({
    id: athlete._id,
    firstName: athlete.firstName,
    lastName: athlete.lastName
  }))
});

// GET /api/coach/groups
exports.listGroups = async (req, res) => {
  try {
    const groups = await CoachGroup.find({ coach: req.user._id })
      .populate('athletes', ATHLETE_FIELDS)
      .sort({ name: 1 })
      .lean();

    // Un athlète qui n'est plus suivi ne doit plus peser dans le compte.
    const allowed = await followedIds(req.user._id);
    res.json(
      groups.map((group) => shape({ ...group, athletes: (group.athletes || []).filter((a) => allowed.has(a._id.toString())) }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/coach/groups
exports.createGroup = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis.' });

    // Les groupes font partie des plans payants : la limite se vérifie ici.
    const room = await groupRoom(req.user._id);
    if (!room.ok) {
      return res.status(402).json({
        error: room.limit === 0
          ? 'Les groupes font partie du plan Coach.'
          : `Le plan ${room.plan.name} permet ${room.limit} groupes.`,
        plan: room.limit === 0 ? 'coach' : 'studio'
      });
    }

    const allowed = await followedIds(req.user._id);
    const group = await CoachGroup.create({
      coach: req.user._id,
      name,
      color: keepColor(req.body.color),
      race: { name: req.body.raceName?.trim() || null, date: req.body.raceDate || null },
      athletes: keepFollowed(req.body.athletes, allowed)
    });

    await group.populate('athletes', ATHLETE_FIELDS);
    res.status(201).json(shape(group.toObject()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Vous avez déjà un groupe de ce nom.' });
    res.status(400).json({ error: error.message });
  }
};

// PATCH /api/coach/groups/:id
exports.updateGroup = async (req, res) => {
  try {
    const group = await CoachGroup.findOne({ _id: req.params.id, coach: req.user._id });
    if (!group) return res.status(404).json({ error: 'Groupe non trouvé' });

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis.' });
      group.name = name;
    }
    if (req.body.color !== undefined) group.color = keepColor(req.body.color);
    if (req.body.athletes !== undefined) {
      group.athletes = keepFollowed(req.body.athletes, await followedIds(req.user._id));
    }
    if (req.body.raceName !== undefined || req.body.raceDate !== undefined) {
      group.race = { name: req.body.raceName?.trim() || null, date: req.body.raceDate || null };
    }

    await group.save();
    await group.populate('athletes', ATHLETE_FIELDS);
    res.json(shape(group.toObject()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Vous avez déjà un groupe de ce nom.' });
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/coach/groups/:id — le groupe disparaît, les athlètes restent suivis.
exports.deleteGroup = async (req, res) => {
  try {
    const group = await CoachGroup.findOneAndDelete({ _id: req.params.id, coach: req.user._id });
    if (!group) return res.status(404).json({ error: 'Groupe non trouvé' });
    res.json({ message: 'Groupe supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
