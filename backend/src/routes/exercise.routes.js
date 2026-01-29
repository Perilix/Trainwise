const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exercise.controller');
const { protect, coachOnly } = require('../middleware/auth.middleware');

// Routes publiques (authentification requise)
router.use(protect);

// Lister les exercices et métadonnées
router.get('/', exerciseController.getExercises);
router.get('/muscle-groups', exerciseController.getMuscleGroups);
router.get('/equipment', exerciseController.getEquipment);
router.get('/:id', exerciseController.getExercise);

// Routes coach/admin only
router.post('/', coachOnly, exerciseController.createExercise);
router.put('/:id', coachOnly, exerciseController.updateExercise);
router.delete('/:id', coachOnly, exerciseController.deleteExercise);

module.exports = router;
