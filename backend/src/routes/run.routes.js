const express = require('express');
const router = express.Router();
const runController = require('../controllers/run.controller');
const { protect } = require('../middleware/auth.middleware');
const checkAIAccess = require('../middleware/checkAIAccess');

// Routes protégées par authentification
router.use(protect);

/**
 * @swagger
 * /api/runs:
 *   post:
 *     summary: Create a new run manually
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, distance, duration]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *               distance:
 *                 type: number
 *                 description: Distance in km
 *               duration:
 *                 type: integer
 *                 description: Duration in seconds
 *               feeling:
 *                 type: string
 *                 enum: [very_bad, bad, neutral, good, very_good]
 *               notes:
 *                 type: string
 *               avgHeartRate:
 *                 type: integer
 *               elevationGain:
 *                 type: number
 *     responses:
 *       201:
 *         description: Run created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all runs for the authenticated user
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of runs
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/', runController.createRun);
router.get('/', runController.getAllRuns);

/**
 * @swagger
 * /api/runs/{id}:
 *   get:
 *     summary: Get a run by ID
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Run data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   patch:
 *     summary: Update a run (feeling, notes, etc.)
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feeling:
 *                 type: string
 *                 enum: [very_bad, bad, neutral, good, very_good]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Run updated
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a run
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Run deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/:id', runController.getRunById);
router.patch('/:id', runController.updateRun);
router.delete('/:id', runController.deleteRun);

/**
 * @swagger
 * /api/runs/{id}/analyze:
 *   post:
 *     summary: Trigger AI analysis for a run (costs 1 TrainCoin)
 *     tags: [Runs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis triggered, result delivered asynchronously via webhook
 *       400:
 *         description: Insufficient TrainCoins
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Run not found
 *       500:
 *         description: Server error
 */
router.post('/:id/analyze', checkAIAccess(1), runController.analyzeRun);

/**
 * @swagger
 * /api/runs/{id}/analysis:
 *   patch:
 *     summary: Update run analysis (N8N webhook callback)
 *     tags: [Runs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               analysis:
 *                 type: string
 *               recommendations:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Analysis saved
 *       404:
 *         description: Run not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/analysis', runController.updateAnalysis);

module.exports = router;
