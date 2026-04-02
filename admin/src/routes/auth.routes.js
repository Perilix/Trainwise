const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/user.model');

const router = express.Router();

// Max 10 tentatives par 15 minutes par IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: null,
  handler: (req, res) => {
    res.render('login', {
      error: 'Trop de tentatives. Réessayez dans 15 minutes.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { error: 'Email et mot de passe requis' });
  }

  try {
    // Vérifie que l'utilisateur existe ET a le rôle admin
    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin' }).select('+password');

    if (!user) {
      return res.render('login', { error: 'Accès refusé' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.render('login', { error: 'Accès refusé' });
    }

    // Stocke l'id + le nom en session (pas juste un booléen)
    req.session.adminId = user._id.toString();
    req.session.adminName = user.firstName || user.email;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Erreur serveur, réessayez' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
