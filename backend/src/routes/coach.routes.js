const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coach.controller');
const { protect, coachOnly } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification + rôle coach
router.use(protect, coachOnly);

/**
 * @swagger
 * /api/coach/stats:
 *   get:
 *     summary: Get coach dashboard statistics
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats (athletes count, sessions, etc.)
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.get('/stats', coachController.getCoachStats);

/**
 * @swagger
 * /api/coach/athletes:
 *   get:
 *     summary: Get all athletes managed by the coach
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of athletes
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.get('/athletes', coachController.getAthletes);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}:
 *   get:
 *     summary: Get a specific athlete's profile
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Athlete profile data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Athlete not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Remove an athlete from the coach's roster
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Athlete removed
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Athlete not found
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId', coachController.getAthleteById);
router.delete('/athletes/:athleteId', coachController.removeAthlete);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/vma:
 *   patch:
 *     summary: Update an athlete's VMA (maximum aerobic speed)
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vma]
 *             properties:
 *               vma:
 *                 type: number
 *                 description: VMA value in km/h
 *     responses:
 *       200:
 *         description: VMA updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Athlete not found
 *       500:
 *         description: Server error
 */
router.patch('/athletes/:athleteId/vma', coachController.updateAthleteVma);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/runs/{runId}:
 *   get:
 *     summary: Get a specific run for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Run data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId/runs/:runId', coachController.getAthleteRun);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/calendar:
 *   get:
 *     summary: Get an athlete's full calendar
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Calendar data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId/calendar', coachController.getAthleteCalendar);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/planning:
 *   get:
 *     summary: Get all planned sessions for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of planned sessions
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a planned session for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       201:
 *         description: Session created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId/planning', coachController.getAthletePlanning);
router.post('/athletes/:athleteId/planning', coachController.createAthleteSession);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/planning/{planId}:
 *   get:
 *     summary: Get a specific planned session for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Planned session data
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   patch:
 *     summary: Update a planned session for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: planId
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
 *         description: Session updated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a planned session for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId/planning/:planId', coachController.getAthletePlannedSession);
router.patch('/athletes/:athleteId/planning/:planId', coachController.updateAthleteSession);
router.delete('/athletes/:athleteId/planning/:planId', coachController.deleteAthleteSession);

/**
 * @swagger
 * /api/coach/athletes/{athleteId}/strength-session/{plannedId}:
 *   get:
 *     summary: Get a planned strength session detail for an athlete
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: plannedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Strength session data
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/athletes/:athleteId/strength-session/:plannedId', coachController.getAthleteStrengthSession);

/**
 * @swagger
 * /api/coach/invite/code:
 *   get:
 *     summary: Get the coach's current invite code
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invite code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 *   post:
 *     summary: Generate a new invite code (invalidates the old one)
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New invite code generated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.get('/invite/code', coachController.getInviteCode);
router.post('/invite/code', coachController.generateInviteCode);

/**
 * @swagger
 * /api/coach/invite/direct:
 *   post:
 *     summary: Send a direct invitation to an athlete by email
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Invitation sent
 *       400:
 *         description: User not found or already in roster
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.post('/invite/direct', coachController.sendDirectInvite);

/**
 * @swagger
 * /api/coach/invitations/pending:
 *   get:
 *     summary: Get pending invitations sent by the coach
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending invitations
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.get('/invitations/pending', coachController.getPendingInvitations);

/**
 * @swagger
 * /api/coach/users/search:
 *   get:
 *     summary: Search users to invite as athletes
 *     tags: [Coach]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (name or email)
 *     responses:
 *       200:
 *         description: List of matching users
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a coach
 *       500:
 *         description: Server error
 */
router.get('/users/search', coachController.searchUsers);

module.exports = router;
