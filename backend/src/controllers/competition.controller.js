const Competition = require('../models/competition.model');

const ALLOWED_FIELDS = [
  'name',
  'date',
  'discipline',
  'distance',
  'elevationGain',
  'targetTime',
  'priority',
  'location',
  'notes',
  'status',
  'result'
];

const pickAllowedFields = (body) => {
  const data = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
};

// Lister les compétitions de l'utilisateur courant
exports.getMyCompetitions = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;

    const competitions = await Competition.find(query).sort({ date: 1 });
    res.json(competitions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupérer une compétition par ID (uniquement la sienne)
exports.getCompetitionById = async (req, res) => {
  try {
    const competition = await Competition.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    if (!competition) {
      return res.status(404).json({ error: 'Compétition non trouvée' });
    }
    res.json(competition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Créer une compétition
exports.createCompetition = async (req, res) => {
  try {
    const data = pickAllowedFields(req.body);
    const competition = await Competition.create({
      ...data,
      user: req.user._id
    });
    res.status(201).json(competition);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Mettre à jour une compétition
exports.updateCompetition = async (req, res) => {
  try {
    const data = pickAllowedFields(req.body);
    const competition = await Competition.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      data,
      { new: true, runValidators: true }
    );
    if (!competition) {
      return res.status(404).json({ error: 'Compétition non trouvée' });
    }
    res.json(competition);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Supprimer une compétition
exports.deleteCompetition = async (req, res) => {
  try {
    const competition = await Competition.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    if (!competition) {
      return res.status(404).json({ error: 'Compétition non trouvée' });
    }
    res.json({ message: 'Compétition supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
