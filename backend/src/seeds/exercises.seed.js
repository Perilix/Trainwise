const mongoose = require('mongoose');
require('dotenv').config();

const Exercise = require('../models/exercise.model');

const exercises = [
  // Pectoraux
  {
    name: 'Développé couché',
    description: 'Exercice de base pour les pectoraux avec barre.',
    instructions: 'Allongé sur un banc, descendez la barre vers la poitrine puis poussez vers le haut.',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
    primaryMuscle: 'chest',
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    name: 'Pompes',
    description: 'Exercice au poids du corps pour les pectoraux.',
    instructions: 'En position de planche, descendez le corps puis poussez vers le haut.',
    muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
    primaryMuscle: 'chest',
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    name: 'Développé incliné haltères',
    description: 'Cible le haut des pectoraux.',
    instructions: 'Sur banc incliné à 30-45°, poussez les haltères vers le haut.',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    primaryMuscle: 'chest',
    equipment: 'dumbbell',
    difficulty: 'intermediate'
  },

  // Dos
  {
    name: 'Tractions',
    description: 'Exercice de base pour le dos.',
    instructions: 'Suspendez-vous à une barre et tirez-vous vers le haut.',
    muscleGroups: ['back', 'biceps', 'core'],
    primaryMuscle: 'back',
    equipment: 'bodyweight',
    difficulty: 'intermediate'
  },
  {
    name: 'Rowing barre',
    description: 'Exercice pour l\'épaisseur du dos.',
    instructions: 'Penché en avant, tirez la barre vers le nombril.',
    muscleGroups: ['back', 'biceps', 'core'],
    primaryMuscle: 'back',
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    name: 'Tirage vertical',
    description: 'Alternative aux tractions à la machine.',
    instructions: 'Tirez la barre vers la poitrine en contractant le dos.',
    muscleGroups: ['back', 'biceps'],
    primaryMuscle: 'back',
    equipment: 'cable',
    difficulty: 'beginner'
  },

  // Épaules
  {
    name: 'Développé militaire',
    description: 'Exercice de base pour les épaules.',
    instructions: 'Debout ou assis, poussez la barre au-dessus de la tête.',
    muscleGroups: ['shoulders', 'triceps'],
    primaryMuscle: 'shoulders',
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    name: 'Élévations latérales',
    description: 'Isolation des deltoïdes moyens.',
    instructions: 'Bras tendus, élevez les haltères sur les côtés jusqu\'à l\'horizontale.',
    muscleGroups: ['shoulders'],
    primaryMuscle: 'shoulders',
    equipment: 'dumbbell',
    difficulty: 'beginner'
  },

  // Jambes
  {
    name: 'Squat',
    description: 'Exercice roi pour les jambes.',
    instructions: 'Barre sur les trapèzes, descendez en fléchissant les genoux et hanches.',
    muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'],
    primaryMuscle: 'quadriceps',
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    name: 'Fentes',
    description: 'Exercice unilatéral pour les jambes.',
    instructions: 'Faites un pas en avant et descendez le genou arrière vers le sol.',
    muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
    primaryMuscle: 'quadriceps',
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    name: 'Soulevé de terre',
    description: 'Exercice complet pour la chaîne postérieure.',
    instructions: 'Gardez le dos droit et soulevez la barre en poussant avec les jambes.',
    muscleGroups: ['hamstrings', 'glutes', 'back', 'core'],
    primaryMuscle: 'hamstrings',
    equipment: 'barbell',
    difficulty: 'advanced'
  },
  {
    name: 'Leg press',
    description: 'Alternative au squat à la machine.',
    instructions: 'Poussez la plateforme avec les pieds en gardant le dos collé.',
    muscleGroups: ['quadriceps', 'glutes'],
    primaryMuscle: 'quadriceps',
    equipment: 'machine',
    difficulty: 'beginner'
  },

  // Bras
  {
    name: 'Curl biceps',
    description: 'Exercice d\'isolation pour les biceps.',
    instructions: 'Bras le long du corps, fléchissez les coudes pour monter les haltères.',
    muscleGroups: ['biceps'],
    primaryMuscle: 'biceps',
    equipment: 'dumbbell',
    difficulty: 'beginner'
  },
  {
    name: 'Extension triceps poulie',
    description: 'Isolation des triceps.',
    instructions: 'Coudes fixés, poussez la corde vers le bas en contractant les triceps.',
    muscleGroups: ['triceps'],
    primaryMuscle: 'triceps',
    equipment: 'cable',
    difficulty: 'beginner'
  },
  {
    name: 'Dips',
    description: 'Exercice au poids du corps pour triceps et pectoraux.',
    instructions: 'Sur barres parallèles, descendez puis poussez vers le haut.',
    muscleGroups: ['triceps', 'chest', 'shoulders'],
    primaryMuscle: 'triceps',
    equipment: 'bodyweight',
    difficulty: 'intermediate'
  },

  // Abdominaux
  {
    name: 'Crunch',
    description: 'Exercice de base pour les abdominaux.',
    instructions: 'Allongé, enroulez le buste vers les genoux en contractant les abdos.',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    name: 'Planche',
    description: 'Gainage pour les abdominaux et le core.',
    instructions: 'En appui sur les avant-bras et orteils, maintenez le corps droit.',
    muscleGroups: ['core', 'shoulders'],
    primaryMuscle: 'core',
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    name: 'Relevé de jambes suspendu',
    description: 'Exercice avancé pour le bas des abdominaux.',
    instructions: 'Suspendu à une barre, relevez les jambes tendues vers l\'horizontal.',
    muscleGroups: ['core'],
    primaryMuscle: 'core',
    equipment: 'bodyweight',
    difficulty: 'advanced'
  }
];

async function seedExercises() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/runiq');
    console.log('Connected to MongoDB');

    // Supprimer les exercices existants
    await Exercise.deleteMany({});
    console.log('Exercices existants supprimés');

    // Insérer les exercices un par un pour que les hooks pre-save s'exécutent (génération slug)
    const created = [];
    for (const exerciseData of exercises) {
      const exercise = new Exercise(exerciseData);
      await exercise.save();
      created.push(exercise);
      console.log(`  ✓ ${exercise.name} (${exercise.slug})`);
    }
    console.log(`\n${created.length} exercices créés avec succès !`);

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

seedExercises();
