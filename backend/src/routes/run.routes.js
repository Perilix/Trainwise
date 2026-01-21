const express = require('express');
const router = express.Router();
const runController = require('../controllers/run.controller');
const { protect } = require('../middleware/auth.middleware');

// Routes protégées par authentification
router.use(protect);

// POST /api/runs - Créer une nouvelle course
router.post('/', runController.createRun);

// GET /api/runs - Récupérer toutes les courses
router.get('/', runController.getAllRuns);

// GET /api/runs/:id - Récupérer une course par ID
router.get('/:id', runController.getRunById);

// POST /api/runs/:id/analyze - Analyser une course avec l'IA
router.post('/:id/analyze', runController.analyzeRun);

// PATCH /api/runs/:id/analysis - Mettre à jour l'analyse (callback n8n)
router.patch('/:id/analysis', runController.updateAnalysis);

// DELETE /api/runs/:id - Supprimer une course
router.delete('/:id', runController.deleteRun);

module.exports = router;
