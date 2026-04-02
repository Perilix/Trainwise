const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');

router.get('/', requireAuth, async (req, res) => {
  const coaches = await User.find({ role: 'coach' }).sort({ createdAt: -1 }).select('firstName lastName email createdAt trainCoins subscriptionStatus coachInviteCode');

  const coachIds = coaches.map(c => c._id);

  const [relationStats, pendingCount] = await Promise.all([
    CoachAthlete.aggregate([
      { $match: { coach: { $in: coachIds } } },
      { $group: { _id: { coach: '$coach', status: '$status' }, count: { $sum: 1 } } }
    ]),
    CoachAthlete.countDocuments({ status: 'pending' })
  ]);

  // Map stats per coach
  const statsMap = {};
  relationStats.forEach(r => {
    const id = r._id.coach.toString();
    if (!statsMap[id]) statsMap[id] = { accepted: 0, pending: 0, rejected: 0 };
    statsMap[id][r._id.status] = r.count;
  });

  const coachesWithStats = coaches.map(c => ({
    ...c.toObject(),
    accepted: statsMap[c._id.toString()]?.accepted || 0,
    pending: statsMap[c._id.toString()]?.pending || 0
  }));

  res.render('coaches', {
    coaches: coachesWithStats,
    total: coaches.length,
    pendingCount
  });
});

// Detail: athletes of a coach
router.get('/:id', requireAuth, async (req, res) => {
  const coach = await User.findById(req.params.id);
  if (!coach || coach.role !== 'coach') return res.redirect('/coaches');

  const relations = await CoachAthlete.find({ coach: coach._id })
    .populate('athlete', 'firstName lastName email subscriptionStatus createdAt')
    .sort({ createdAt: -1 });

  res.render('coach-detail', { coach, relations });
});

module.exports = router;
