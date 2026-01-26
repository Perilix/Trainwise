const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coach.controller');
const { protect, coachOnly } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification + rôle coach
router.use(protect, coachOnly);

// Statistiques dashboard
router.get('/stats', coachController.getCoachStats);

// Gestion des athlètes
router.get('/athletes', coachController.getAthletes);
router.get('/athletes/:athleteId', coachController.getAthleteById);
router.delete('/athletes/:athleteId', coachController.removeAthlete);

// Calendrier et planning des athlètes
router.get('/athletes/:athleteId/calendar', coachController.getAthleteCalendar);
router.get('/athletes/:athleteId/planning', coachController.getAthletePlanning);
router.post('/athletes/:athleteId/planning', coachController.createAthleteSession);
router.patch('/athletes/:athleteId/planning/:planId', coachController.updateAthleteSession);
router.delete('/athletes/:athleteId/planning/:planId', coachController.deleteAthleteSession);

// Invitations
router.get('/invite/code', coachController.getInviteCode);
router.post('/invite/code', coachController.generateInviteCode);
router.post('/invite/direct', coachController.sendDirectInvite);
router.get('/invitations/pending', coachController.getPendingInvitations);

// Recherche d'utilisateurs pour invitation
router.get('/users/search', coachController.searchUsers);

module.exports = router;
