const express = require('express');
const router = express.Router();
const stravaController = require('../controllers/strava.controller');
const { protect } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/strava/callback:
 *   get:
 *     summary: OAuth callback from Strava after user authorization
 *     tags: [Strava]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Strava
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter (contains JWT token)
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Error if user denied access
 *     responses:
 *       302:
 *         description: Redirect to frontend after processing
 *       400:
 *         description: Missing code or access denied
 *       500:
 *         description: Server error
 */
router.get('/callback', stravaController.handleCallback);

// Routes protégées
router.use(protect);

/**
 * @swagger
 * /api/strava/auth-url:
 *   get:
 *     summary: Get the Strava OAuth authorization URL
 *     tags: [Strava]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authorization URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/auth-url', stravaController.getAuthUrl);

/**
 * @swagger
 * /api/strava/status:
 *   get:
 *     summary: Check Strava connection status for the current user
 *     tags: [Strava]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 athleteName:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/status', stravaController.getStatus);

/**
 * @swagger
 * /api/strava/sync:
 *   post:
 *     summary: Sync recent Strava activities
 *     tags: [Strava]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activities synced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Strava not connected
 *       500:
 *         description: Server error
 */
router.post('/sync', stravaController.syncActivities);

/**
 * @swagger
 * /api/strava/resync:
 *   post:
 *     summary: Re-sync all existing Strava activities (full refresh)
 *     tags: [Strava]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All activities re-synced
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Strava not connected
 *       500:
 *         description: Server error
 */
router.post('/resync', stravaController.resyncActivities);

router.post('/rematch', stravaController.rematchExistingActivities);

/**
 * @swagger
 * /api/strava/disconnect:
 *   delete:
 *     summary: Disconnect the Strava account
 *     tags: [Strava]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Strava disconnected
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/disconnect', stravaController.disconnect);

module.exports = router;
