const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const router = express.Router();
const contactController = require('../controllers/contact.controller');
const User = require('../models/user.model');

/** Le compte, s'il y en a un : écrire ne l'exige pas. */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    }
  } catch {
    // Jeton absent ou périmé : on continue en anonyme.
  }
  next();
};

// Un formulaire public s'arrose vite : trois envois par minute et par IP.
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Réessayez dans une minute.' }
});

router.post('/', submitLimiter, optionalAuth, contactController.createMessage);

module.exports = router;
