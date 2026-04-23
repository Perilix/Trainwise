const express = require('express');
const router = express.Router();
const strengthController = require('../controllers/strength.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

/**
 * @swagger
 * /api/strength/session-types:
 *   get:
 *     summary: Get available strength session types
 *     tags: [Strength]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of session types
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                   label:
 *                     type: string
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/session-types', strengthController.getSessionTypes);

/**
 * @swagger
 * /api/strength/stats:
 *   get:
 *     summary: Get strength training statistics for the current user
 *     tags: [Strength]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Strength stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSessions:
 *                   type: integer
 *                 totalDuration:
 *                   type: integer
 *                 thisWeek:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/stats', strengthController.getStats);

/**
 * @swagger
 * /api/strength/sessions:
 *   post:
 *     summary: Create a new strength training session
 *     tags: [Strength]
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
 *                 format: date-time
 *               type:
 *                 type: string
 *               duration:
 *                 type: integer
 *                 description: Duration in minutes
 *               exercises:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     exerciseId:
 *                       type: string
 *                     sets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           reps:
 *                             type: integer
 *                           weight:
 *                             type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get all strength sessions for the current user
 *     tags: [Strength]
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
 *         description: List of strength sessions
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/sessions', strengthController.createSession);
router.get('/sessions', strengthController.getSessions);

/**
 * @swagger
 * /api/strength/sessions/{id}:
 *   get:
 *     summary: Get a strength session by ID
 *     tags: [Strength]
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
 *         description: Strength session data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update a strength session
 *     tags: [Strength]
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
 *               duration:
 *                 type: integer
 *               exercises:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session updated
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a strength session
 *     tags: [Strength]
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
 *         description: Session deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/sessions/:id', strengthController.getSession);
router.put('/sessions/:id', strengthController.updateSession);
router.delete('/sessions/:id', strengthController.deleteSession);

module.exports = router;
