const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const pushNotificationController = require('../controllers/pushNotification.controller');

/**
 * @swagger
 * /api/users/push-token:
 *   post:
 *     summary: Register a push notification token for the current device
 *     tags: [PushNotifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM or APNs push token
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *     responses:
 *       200:
 *         description: Token registered
 *       400:
 *         description: Missing token
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Remove the push notification token for the current device
 *     tags: [PushNotifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token to remove (removes all if omitted)
 *     responses:
 *       200:
 *         description: Token removed
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/push-token', protect, pushNotificationController.savePushToken);
router.delete('/push-token', protect, pushNotificationController.removePushToken);

module.exports = router;
