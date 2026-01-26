const express = require('express');
const router = express.Router();
const athleteController = require('../controllers/athlete.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Invitations
router.get('/invitations', athleteController.getPendingInvitations);
router.post('/invitations/:invitationId/accept', athleteController.acceptInvitation);
router.post('/invitations/:invitationId/reject', athleteController.rejectInvitation);

// Rejoindre via code
router.post('/join/:code', athleteController.joinViaCode);

// Coach actuel
router.get('/coach', athleteController.getCurrentCoach);
router.delete('/coach', athleteController.leaveCoach);

module.exports = router;
