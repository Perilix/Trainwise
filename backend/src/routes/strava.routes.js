const express = require('express');
const router = express.Router();
const stravaController = require('../controllers/strava.controller');
const { protect } = require('../middleware/auth.middleware');

// Route publique - Callback OAuth (Strava redirige ici)
router.get('/callback', stravaController.handleCallback);

// Routes protégées
router.use(protect);

// GET /api/strava/auth-url - Obtenir l'URL d'autorisation Strava
router.get('/auth-url', stravaController.getAuthUrl);

// GET /api/strava/status - Vérifier le statut de connexion
router.get('/status', stravaController.getStatus);

// POST /api/strava/sync - Synchroniser les activités
router.post('/sync', stravaController.syncActivities);

// POST /api/strava/resync - Resynchroniser les activités existantes
router.post('/resync', stravaController.resyncActivities);

// DELETE /api/strava/disconnect - Déconnecter le compte Strava
router.delete('/disconnect', stravaController.disconnect);

module.exports = router;
