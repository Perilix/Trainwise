const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const pushNotificationController = require('../controllers/pushNotification.controller');

// @route   POST /api/users/push-token
// @desc    Enregistrer le push token de l'utilisateur
// @access  Private
router.post('/push-token', protect, pushNotificationController.savePushToken);

// @route   DELETE /api/users/push-token
// @desc    Supprimer le push token de l'utilisateur
// @access  Private
router.delete('/push-token', protect, pushNotificationController.removePushToken);

module.exports = router;
