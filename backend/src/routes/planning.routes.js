const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planning.controller');
const { protect } = require('../middleware/auth.middleware');
const checkAIAccess = require('../middleware/checkAIAccess');

// Toutes les routes sont protégées
router.use(protect);

/**
 * @swagger
 * /api/planning/calendar:
 *   get:
 *     summary: Get the full calendar data (planned sessions + completed runs)
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start of the period (ISO date)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End of the period (ISO date)
 *     responses:
 *       200:
 *         description: Calendar data grouped by day
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/calendar', planningController.getCalendarData);

/**
 * @swagger
 * /api/planning/generate:
 *   post:
 *     summary: Generate a training plan with AI (costs 3 TrainCoins)
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weeks:
 *                 type: integer
 *                 default: 1
 *                 description: Number of weeks to generate
 *               startDate:
 *                 type: string
 *                 format: date
 *               dayConfig:
 *                 type: object
 *                 description: Configuration for each day of the week
 *               forceOverwrite:
 *                 type: boolean
 *                 default: false
 *                 description: Overwrite existing planned sessions on conflicting days
 *     responses:
 *       200:
 *         description: Plan generated successfully
 *       400:
 *         description: Insufficient TrainCoins or validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/generate', checkAIAccess(5), planningController.generatePlan);

/**
 * @swagger
 * /api/planning/confirm:
 *   post:
 *     summary: Confirm and save an AI-generated plan
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Plan confirmed and saved
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/confirm', planningController.confirmPlan);

/**
 * @swagger
 * /api/planning:
 *   get:
 *     summary: Get all planned sessions for the authenticated user
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of planned sessions
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a planned session manually
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, type]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [running, strength]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes
 *     responses:
 *       201:
 *         description: Planned session created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/', planningController.getPlannedRuns);
router.post('/', planningController.createPlannedRun);

/**
 * @swagger
 * /api/planning/{id}:
 *   get:
 *     summary: Get a planned session by ID
 *     tags: [Planning]
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
 *         description: Planned session data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   patch:
 *     summary: Update a planned session
 *     tags: [Planning]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Planned session updated
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a planned session
 *     tags: [Planning]
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
 *         description: Deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/:id', planningController.getPlannedRunById);
router.patch('/:id', planningController.updatePlannedRun);
router.delete('/:id', planningController.deletePlannedRun);

/**
 * @swagger
 * /api/planning/{id}/status:
 *   patch:
 *     summary: Update the status of a planned session
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [planned, completed, skipped]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', planningController.updateStatus);

module.exports = router;
