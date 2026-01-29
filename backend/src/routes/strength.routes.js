const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strength.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Métadonnées
router.get('/session-types', strengthController.getSessionTypes);

// Stats
router.get('/stats', strengthController.getStats);

// CRUD séances
router.post('/sessions', strengthController.createSession);
router.get('/sessions', strengthController.getSessions);
router.get('/sessions/:id', strengthController.getSession);
router.put('/sessions/:id', strengthController.updateSession);
router.delete('/sessions/:id', strengthController.deleteSession);

module.exports = router;
