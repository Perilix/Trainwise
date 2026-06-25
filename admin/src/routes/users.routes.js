const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const Run = require('../models/run.model');

// Catalogue des visites guidées (feature tours) — doit rester aligné avec les pageId du frontend
const TOUR_PAGES = [
  { id: 'dashboard',            label: 'Accueil (tableau de bord)' },
  { id: 'sorties',             label: 'Mes sorties' },
  { id: 'planning',            label: 'Planning' },
  { id: 'analyse',             label: 'Analyse (nouvelle course)' },
  { id: 'profile',             label: 'Profil' },
  { id: 'coach-dashboard',     label: 'Espace coach' },
  { id: 'run-detail-complete', label: 'Détail séance — compléter (séance coach)' },
  { id: 'run-detail-view',     label: 'Détail séance — visualisation' },
];
const TOUR_IDS = TOUR_PAGES.map(p => p.id);

// ── List users ──────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { search = '', role = '', subscription = '', page = 1 } = req.query;
  const limit = 25;
  const skip = (parseInt(page) - 1) * limit;

  const filter = {};
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) filter.role = role;
  if (subscription) filter.subscriptionStatus = subscription;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .select('firstName lastName email role subscriptionStatus trainCoins createdAt hasCompletedOnboarding toursSeen strava'),
    User.countDocuments(filter)
  ]);

  res.render('users', {
    users, total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    search, role, subscription,
    deleted: req.query.deleted === '1'
  });
});

// ── New user form ────────────────────────────────────────────
// IMPORTANT: cette route doit être AVANT /:id
router.get('/new', requireAuth, (req, res) => {
  res.render('user-create', { error: null });
});

// ── Create user ──────────────────────────────────────────────
router.post('/new', requireAuth, async (req, res) => {
  const { firstName, lastName, email, password, role, subscriptionStatus, trainCoins } = req.body;

  if (!email || !password) {
    return res.render('user-create', { error: 'Email et mot de passe requis' });
  }

  if (password.length < 6) {
    return res.render('user-create', { error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('user-create', { error: 'Un utilisateur avec cet email existe déjà' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || 'user',
      subscriptionStatus: subscriptionStatus || 'free',
      trainCoins: parseFloat(trainCoins) || 10
    });

    res.redirect(`/users/${user._id}?success=1`);
  } catch (err) {
    console.error('Create user error:', err);
    res.render('user-create', { error: 'Erreur lors de la création : ' + err.message });
  }
});

// ── User detail + edit form ──────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.redirect('/users');

  const [runCount, runsAgg] = await Promise.all([
    Run.countDocuments({ user: user._id }),
    Run.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, totalKm: { $sum: '$distance' }, avgFeeling: { $avg: '$feeling' } } }
    ])
  ]);

  res.render('user-edit', {
    user,
    runCount,
    totalKm: Math.round(runsAgg[0]?.totalKm || 0),
    avgFeeling: runsAgg[0]?.avgFeeling ? (Math.round(runsAgg[0].avgFeeling * 10) / 10) : '-',
    tourPages: TOUR_PAGES,
    success: req.query.success === '1',
    error: null
  });
});

// ── Update user ──────────────────────────────────────────────
router.post('/:id', requireAuth, async (req, res) => {
  const { firstName, lastName, email, password, role, subscriptionStatus, trainCoins, subscriptionExpiry } = req.body;

  const update = {
    firstName: firstName?.trim() || undefined,
    lastName: lastName?.trim() || undefined,
    role,
    subscriptionStatus,
    trainCoins: parseFloat(trainCoins) || 0,
    subscriptionExpiry: subscriptionExpiry ? new Date(subscriptionExpiry) : null
  };

  // Mise à jour email si changé
  if (email) update.email = email.toLowerCase().trim();

  // Mise à jour password uniquement si renseigné
  if (password && password.trim().length >= 6) {
    const salt = await bcrypt.genSalt(10);
    update.password = await bcrypt.hash(password.trim(), salt);
  }

  await User.findByIdAndUpdate(req.params.id, update);
  res.redirect(`/users/${req.params.id}?success=1`);
});

// ── Manage onboarding & feature tours ────────────────────────
router.post('/:id/onboarding', requireAuth, async (req, res) => {
  // Réinitialiser toutes les visites guidées (l'utilisateur les reverra)
  if (req.body.action === 'reset') {
    await User.findByIdAndUpdate(req.params.id, { toursSeen: [] });
    return res.redirect(`/users/${req.params.id}?success=1`);
  }

  // Les cases cochées arrivent sous req.body.toursSeen (string si une seule, array si plusieurs)
  let toursSeen = req.body.toursSeen || [];
  if (!Array.isArray(toursSeen)) toursSeen = [toursSeen];
  toursSeen = toursSeen.filter(t => TOUR_IDS.includes(t));

  await User.findByIdAndUpdate(req.params.id, {
    hasCompletedOnboarding: req.body.hasCompletedOnboarding === 'on',
    toursSeen
  });
  res.redirect(`/users/${req.params.id}?success=1`);
});

// ── Delete user ──────────────────────────────────────────────
router.post('/:id/delete', requireAuth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.redirect('/users?deleted=1');
});

// ── Impersonate user (login as) ──────────────────────────────
router.post('/:id/impersonate', requireAuth, async (req, res) => {
  const { JWT_SECRET, FRONTEND_URL, FRONTEND_URL_LOCAL, FRONTEND_URL_PROD } = process.env;

  if (!JWT_SECRET) {
    return res.status(500).send('JWT_SECRET non configuré côté admin');
  }

  const target = req.body.target === 'prod' ? 'prod' : 'local';
  const targetUrl = target === 'prod'
    ? (FRONTEND_URL_PROD || FRONTEND_URL)
    : (FRONTEND_URL_LOCAL || FRONTEND_URL);

  if (!targetUrl) {
    return res.status(500).send(`URL frontend ${target} non configurée (FRONTEND_URL_${target.toUpperCase()} ou FRONTEND_URL)`);
  }

  const user = await User.findById(req.params.id).select('_id email firstName lastName role');
  if (!user) {
    return res.redirect('/users');
  }

  const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '1h' });

  console.log(
    `[IMPERSONATE] admin=${req.session.adminName || req.session.adminId} → user=${user.email} (${user._id}) role=${user.role} target=${target}`
  );

  const redirectUrl = `${targetUrl.replace(/\/$/, '')}/impersonate#token=${encodeURIComponent(token)}`;
  res.redirect(redirectUrl);
});

module.exports = router;
