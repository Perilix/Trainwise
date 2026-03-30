const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { protect } = require('../middleware/auth.middleware');
const checkAIAccess = require('../middleware/checkAIAccess');

// Toutes les routes sont protégées
router.use(protect);

// Calendrier
router.get('/calendar', planningController.getCalendarData);

// Génération de plan IA (coûte 3 TrainCoins)
router.post('/generate', checkAIAccess(3), planningController.generatePlan);
router.post('/confirm', planningController.confirmPlan);

// CRUD séances planifiées
router.get('/', planningController.getPlannedRuns);
router.get('/:id', planningController.getPlannedRunById);
router.post('/', planningController.createPlannedRun);
router.patch('/:id', planningController.updatePlannedRun);
router.delete('/:id', planningController.deletePlannedRun);

// Mise à jour du statut
router.patch('/:id/status', planningController.updateStatus);

module.exports = router;
