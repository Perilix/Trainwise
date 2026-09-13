const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const betaFeedbackController = require('../controllers/betaFeedback.controller');
const { protect } = require('../middleware/auth.middleware');

const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    }
  } catch (_) {
    // ignore — route publique
  }
  next();
};

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de retours envoyés, réessaye dans une minute.' }
});

/**
 * @swagger
 * /api/beta/feedback:
 *   post:
 *     summary: Soumettre un retour bêta
 *     tags: [BetaFeedback]
 *     responses:
 *       201:
 *         description: Retour créé, renvoie un ticketId
 */
router.post('/feedback', submitLimiter, optionalAuth, betaFeedbackController.createFeedback);

/**
 * @swagger
 * /api/beta/stats:
 *   get:
 *     summary: Stats publiques du programme bêta
 *     tags: [BetaFeedback]
 */
router.get('/stats', betaFeedbackController.getStats);

/**
 * @swagger
 * /api/beta/feedback/community:
 *   get:
 *     summary: Liste des retours publics votables
 *     tags: [BetaFeedback]
 */
router.get('/feedback/community', betaFeedbackController.getCommunity);

/**
 * @swagger
 * /api/beta/feedback/my-count:
 *   get:
 *     summary: Nombre de retours de l'utilisateur courant (mois + total)
 *     tags: [BetaFeedback]
 *     security:
 *       - bearerAuth: []
 */
router.get('/feedback/my-count', protect, betaFeedbackController.getMyCount);

/**
 * @swagger
 * /api/beta/feedback/{id}/vote:
 *   post:
 *     summary: Toggle upvote sur un retour communautaire
 *     tags: [BetaFeedback]
 */
router.post('/feedback/:id/vote', betaFeedbackController.toggleVote);

module.exports = router;
