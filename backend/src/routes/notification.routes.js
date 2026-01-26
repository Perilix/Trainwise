const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Obtenir les notifications
router.get('/', notificationController.getNotifications);

// Obtenir le nombre de non lues
router.get('/unread-count', notificationController.getUnreadCount);

// Marquer toutes comme lues
router.patch('/read-all', notificationController.markAllAsRead);

// Marquer une notification comme lue
router.patch('/:id/read', notificationController.markAsRead);

// Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
