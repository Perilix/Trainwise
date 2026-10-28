const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/user.model');
const { BureauUser } = require('../models/prospection');

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
  if (req.session.bureau) return res.redirect('/bureau');
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/dashboard');
  if (req.session.bureau) return res.redirect('/bureau');
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

    if (user && await user.comparePassword(password)) {
      // Stocke l'id + le nom en session (pas juste un booléen)
      req.session.adminId = user._id.toString();
      req.session.adminName = user.firstName || user.email;
      // L'admin tient le bureau de Julien et peut agir sur les deux.
      req.session.bureau = { prenom: user.firstName || 'Julien', espace: 'julien', admin: true };
      return res.redirect('/dashboard');
    }

    // Sinon, un compte du bureau de prospection (base séparée) : accès au bureau seulement.
    const membre = await BureauUser.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (membre && await membre.comparePassword(password)) {
      req.session.bureau = { id: membre._id.toString(), prenom: membre.prenom, espace: membre.espace, admin: false };
      return res.redirect('/bureau');
    }

    return res.render('login', { error: 'Accès refusé' });
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
