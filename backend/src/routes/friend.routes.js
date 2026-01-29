const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friend.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Rechercher des utilisateurs
router.get('/search', friendController.searchUsers);

// Liste d'amis
router.get('/', friendController.getFriends);

// Demandes reçues en attente
router.get('/requests/pending', friendController.getPendingRequests);

// Demandes envoyées en attente
router.get('/requests/sent', friendController.getSentRequests);

// Statut d'amitié avec un utilisateur
router.get('/status/:userId', friendController.getFriendshipStatus);

// Profil d'un ami
router.get('/profile/:userId', friendController.getFriendProfile);

// Envoyer une demande d'ami
router.post('/request/:userId', friendController.sendFriendRequest);

// Répondre à une demande (accept: true/false dans le body)
router.patch('/request/:friendshipId/respond', friendController.respondToFriendRequest);

// Annuler une demande envoyée
router.delete('/request/:userId', friendController.cancelFriendRequest);

// Supprimer un ami
router.delete('/:userId', friendController.removeFriend);

module.exports = router;
