const express = require('express');
const router = express.Router();
const athleteController = require('../controllers/athlete.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

/**
 * @swagger
 * /api/athlete/invitations:
 *   get:
 *     summary: Get pending coach invitations for the athlete
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending invitations
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/invitations', athleteController.getPendingInvitations);

/**
 * @swagger
 * /api/athlete/invitations/{invitationId}/accept:
 *   post:
 *     summary: Accept a coach invitation
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Server error
 */
router.post('/invitations/:invitationId/accept', athleteController.acceptInvitation);

/**
 * @swagger
 * /api/athlete/invitations/{invitationId}/reject:
 *   post:
 *     summary: Reject a coach invitation
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation rejected
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Invitation not found
 *       500:
 *         description: Server error
 */
router.post('/invitations/:invitationId/reject', athleteController.rejectInvitation);

/**
 * @swagger
 * /api/athlete/join/{code}:
 *   post:
 *     summary: Join a coach via invite code
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Coach's invite code
 *     responses:
 *       200:
 *         description: Successfully joined the coach
 *       400:
 *         description: Invalid code or already has a coach
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Code not found
 *       500:
 *         description: Server error
 */
router.post('/join/:code', athleteController.joinViaCode);

/**
 * @swagger
 * /api/athlete/coach:
 *   get:
 *     summary: Get the athlete's current coach
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coach profile data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No coach assigned
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Leave the current coach
 *     tags: [Athlete]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully left the coach
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No coach assigned
 *       500:
 *         description: Server error
 */
router.get('/coach', athleteController.getCurrentCoach);
router.delete('/coach', athleteController.leaveCoach);

module.exports = router;
