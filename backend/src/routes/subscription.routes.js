const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { protect } = require('../middleware/auth.middleware');

// Webhook RevenueCat — pas de JWT, auth via secret header
router.post('/webhook', subscriptionController.revenueCatWebhook);

// Routes protégées
router.get('/status', protect, subscriptionController.getStatus);
router.post('/link-revenuecat', protect, subscriptionController.linkRevenueCat);

module.exports = router;
