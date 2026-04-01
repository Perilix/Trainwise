const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const Run = require('../models/run.model');

// List users
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
      .select('firstName lastName email role subscriptionStatus trainCoins createdAt hasCompletedOnboarding strava'),
    User.countDocuments(filter)
  ]);

  res.render('users', {
    users,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    search, role, subscription
  });
});

// User detail + edit form
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
    success: req.query.success === '1',
    error: null
  });
});

// Update user
router.post('/:id', requireAuth, async (req, res) => {
  const { role, subscriptionStatus, trainCoins, subscriptionExpiry } = req.body;

  const update = {
    role,
    subscriptionStatus,
    trainCoins: parseFloat(trainCoins) || 0,
    subscriptionExpiry: subscriptionExpiry ? new Date(subscriptionExpiry) : null
  };

  await User.findByIdAndUpdate(req.params.id, update);
  res.redirect(`/users/${req.params.id}?success=1`);
});

module.exports = router;
