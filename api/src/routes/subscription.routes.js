const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { protect } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/subscription/webhook:
 *   post:
 *     summary: RevenueCat webhook for subscription events
 *     tags: [Subscription]
 *     description: >
 *       Called by RevenueCat when a subscription event occurs (purchase, renewal, cancellation).
 *       Authenticated via the `X-RevenueCat-Signature` or secret header, not JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: RevenueCat webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Invalid webhook secret
 *       500:
 *         description: Server error
 */
router.post('/webhook', subscriptionController.revenueCatWebhook);

/**
 * @swagger
 * /api/subscription/status:
 *   get:
 *     summary: Get the current user's subscription status
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [free, pro]
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 trainCoins:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/status', protect, subscriptionController.getStatus);

/**
 * @swagger
 * /api/subscription/link-revenuecat:
 *   post:
 *     summary: Link a RevenueCat customer ID to the current user
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [revenueCatId]
 *             properties:
 *               revenueCatId:
 *                 type: string
 *                 description: RevenueCat app user ID
 *     responses:
 *       200:
 *         description: RevenueCat ID linked
 *       400:
 *         description: Missing revenueCatId
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/link-revenuecat', protect, subscriptionController.linkRevenueCat);

module.exports = router;
