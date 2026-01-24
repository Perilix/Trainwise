const express = require('express');
const router = express.Router();
const garminController = require('../controllers/garmin.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes sont protégées
router.use(protect);

// POST /api/garmin/connect - Connecter le compte Garmin
router.post('/connect', garminController.connect);

// GET /api/garmin/status - Vérifier le statut de connexion
router.get('/status', garminController.getStatus);

// POST /api/garmin/sync - Synchroniser les activités
router.post('/sync', garminController.syncActivities);

// GET /api/garmin/stats - Récupérer les stats utilisateur
router.get('/stats', garminController.getUserStats);

// DELETE /api/garmin/disconnect - Déconnecter le compte
router.delete('/disconnect', garminController.disconnect);

module.exports = router;
