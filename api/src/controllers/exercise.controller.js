const Exercise = require('../models/exercise.model');

exports.getExercises = async (req, res) => {
  try {
    // Le catalogue complet + les exercices perso du coach : sans limite basse, sinon
    // l'éditeur muscu ne propose qu'une partie des exercices.
    const { muscle, equipment, difficulty, search, limit = 1000 } = req.query;

    const query = {
      $or: [
        { createdBy: req.user._id },
        { isPublic: true }
      ]
    };

    // Filtres
    if (muscle) {
      query.muscleGroups = muscle;
    }
    if (equipment) {
      query.equipment = equipment;
    }
    if (difficulty) {
      query.difficulty = difficulty;
    }
    if (search) {
      query.$text = { $search: search };
    }

    const exercises = await Exercise.find(query)
      .select('name slug description instructions primaryMuscle muscleGroups equipment difficulty videoUrl imageUrl thumbnailUrl isPublic createdBy')
      .limit(Math.min(parseInt(limit) || 1000, 2000))
      .sort({ name: 1 });

    res.json(exercises);
  } catch (error) {
    console.error('Error getting exercises:', error);
    res.status(500).json({ error: error.message });
  }
};

// Détail d'un exercice
exports.getExercise = async (req, res) => {
  try {
    const { id } = req.params;

    const exercise = await Exercise.findById(id)
      .populate('createdBy', 'firstName lastName');

    if (!exercise) {
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    res.json(exercise);
  } catch (error) {
    console.error('Error getting exercise:', error);
    res.status(500).json({ error: error.message });
  }
};

// Créer un exercice (coach/admin only)
exports.createExercise = async (req, res) => {
  try {
    const {
      name,
      description,
      instructions,
      muscleGroups,
      primaryMuscle,
      equipment,
      difficulty,
      videoUrl,
      imageUrl,
      thumbnailUrl,
      isPublic
    } = req.body;

    const exercise = await Exercise.create({
      name,
      description,
      instructions,
      muscleGroups,
      primaryMuscle,
      equipment,
      difficulty,
      videoUrl,
      imageUrl,
      thumbnailUrl,
      // Exo créé par un coach = privé par défaut (bibliothèque perso)
      isPublic: isPublic === true,
      createdBy: req.user._id
    });

    res.status(201).json(exercise);
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ error: error.message });
  }
};

// Champs qu'un coach peut renseigner sur ses propres exercices.
// isPublic : le coach choisit de partager son exercice avec tous les coachs (privé par défaut).
const EDITABLE_FIELDS = [
  'name', 'description', 'instructions', 'muscleGroups', 'primaryMuscle',
  'equipment', 'difficulty', 'videoUrl', 'imageUrl', 'thumbnailUrl', 'isPublic'
];

const pickEditable = (body) => Object.fromEntries(
  EDITABLE_FIELDS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]])
);

// Un exercice du catalogue (sans créateur) n'appartient à aucun coach : seul un admin y touche.
const canEdit = (exercise, user) =>
  user.role === 'admin' || (exercise.createdBy && exercise.createdBy.toString() === user._id.toString());

// Modifier un exercice (coach/admin only)
exports.updateExercise = async (req, res) => {
  try {
    const { id } = req.params;

    const exercise = await Exercise.findById(id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    if (!canEdit(exercise, req.user)) {
      return res.status(403).json({ error: 'Non autorisé à modifier cet exercice' });
    }

    const updates = pickEditable(req.body);
    if (updates.isPublic !== undefined) updates.isPublic = updates.isPublic === true;
    Object.assign(exercise, updates);
    await exercise.save();

    res.json(exercise);
  } catch (error) {
    console.error('Error updating exercise:', error);
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ error: error.message });
  }
};

// Supprimer un exercice (coach/admin only)
exports.deleteExercise = async (req, res) => {
  try {
    const { id } = req.params;

    const exercise = await Exercise.findById(id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    if (!canEdit(exercise, req.user)) {
      return res.status(403).json({ error: 'Non autorisé à supprimer cet exercice' });
    }

    await exercise.deleteOne();

    res.json({ message: 'Exercice supprimé' });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    res.status(500).json({ error: error.message });
  }
};

const MUSCLES = Exercise.schema.path('primaryMuscle').enumValues;
const EQUIPMENTS = Exercise.schema.path('equipment').enumValues;
const IMPORT_MAX = 300;

// Import d'une liste d'exercices perso (copier-coller depuis un tableur).
// Les noms déjà présents chez le coach sont ignorés plutôt que dupliqués.
exports.importExercises = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.exercises) ? req.body.exercises : [];
    if (!rows.length) return res.status(400).json({ error: 'Aucun exercice à importer' });
    if (rows.length > IMPORT_MAX) {
      return res.status(400).json({ error: `${IMPORT_MAX} exercices maximum par import` });
    }

    const mine = await Exercise.find({ createdBy: req.user._id }).select('name').lean();
    const known = new Set(mine.map((exercise) => exercise.name.trim().toLowerCase()));

    const toCreate = [];
    let skipped = 0;
    for (const row of rows) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name || known.has(name.toLowerCase())) {
        skipped += 1;
        continue;
      }
      known.add(name.toLowerCase());
      const primaryMuscle = MUSCLES.includes(row.primaryMuscle) ? row.primaryMuscle : undefined;
      toCreate.push({
        name,
        primaryMuscle,
        muscleGroups: primaryMuscle ? [primaryMuscle] : [],
        equipment: EQUIPMENTS.includes(row.equipment) ? row.equipment : 'other',
        instructions: typeof row.instructions === 'string' ? row.instructions.trim() : undefined,
        videoUrl: typeof row.videoUrl === 'string' ? row.videoUrl.trim() || undefined : undefined,
        isPublic: false,
        createdBy: req.user._id
      });
    }

    // create() un à un : le slug est posé par le hook pre('save'), que insertMany ne déclenche pas.
    const created = [];
    for (const doc of toCreate) created.push(await Exercise.create(doc));

    res.status(201).json({ created: created.length, skipped, exercises: created });
  } catch (error) {
    console.error('Error importing exercises:', error);
    res.status(500).json({ error: error.message });
  }
};

// Liste des muscles disponibles
exports.getMuscleGroups = async (req, res) => {
  const muscleGroups = [
    { value: 'chest', label: 'Pectoraux' },
    { value: 'back', label: 'Dos' },
    { value: 'shoulders', label: 'Épaules' },
    { value: 'biceps', label: 'Biceps' },
    { value: 'triceps', label: 'Triceps' },
    { value: 'forearms', label: 'Avant-bras' },
    { value: 'core', label: 'Abdominaux' },
    { value: 'quadriceps', label: 'Quadriceps' },
    { value: 'hamstrings', label: 'Ischio-jambiers' },
    { value: 'glutes', label: 'Fessiers' },
    { value: 'calves', label: 'Mollets' },
    { value: 'full_body', label: 'Corps complet' }
  ];

  res.json(muscleGroups);
};

// Liste des équipements disponibles
exports.getEquipment = async (req, res) => {
  const equipment = [
    { value: 'barbell', label: 'Barre' },
    { value: 'dumbbell', label: 'Haltères' },
    { value: 'kettlebell', label: 'Kettlebell' },
    { value: 'machine', label: 'Machine' },
    { value: 'cable', label: 'Câble/Poulie' },
    { value: 'bodyweight', label: 'Poids du corps' },
    { value: 'resistance_band', label: 'Élastique' },
    { value: 'other', label: 'Autre' }
  ];

  res.json(equipment);
};

// Upload image d'exercice (coach/admin only)
exports.uploadExerciseImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }

    res.json({
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading exercise image:', error);
    res.status(500).json({ error: error.message });
  }
};
