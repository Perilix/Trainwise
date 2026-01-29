const Exercise = require('../models/exercise.model');

// Lister tous les exercices (avec filtres)
exports.getExercises = async (req, res) => {
  try {
    const { muscle, equipment, difficulty, search, limit = 50 } = req.query;

    const query = { isPublic: true };

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
      .select('name slug description primaryMuscle muscleGroups equipment difficulty imageUrl thumbnailUrl')
      .limit(parseInt(limit))
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
      isPublic: isPublic !== false,
      createdBy: req.user._id
    });

    res.status(201).json(exercise);
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(500).json({ error: error.message });
  }
};

// Modifier un exercice (coach/admin only)
exports.updateExercise = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const exercise = await Exercise.findById(id);

    if (!exercise) {
      return res.status(404).json({ error: 'Exercice non trouvé' });
    }

    // Vérifier que l'utilisateur est le créateur ou admin
    if (exercise.createdBy &&
        exercise.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé à modifier cet exercice' });
    }

    Object.assign(exercise, updates);
    await exercise.save();

    res.json(exercise);
  } catch (error) {
    console.error('Error updating exercise:', error);
    res.status(500).json({ error: error.message });
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

    // Vérifier que l'utilisateur est le créateur ou admin
    if (exercise.createdBy &&
        exercise.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé à supprimer cet exercice' });
    }

    await exercise.deleteOne();

    res.json({ message: 'Exercice supprimé' });
  } catch (error) {
    console.error('Error deleting exercise:', error);
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
