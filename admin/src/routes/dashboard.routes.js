const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const Run = require('../models/run.model');

router.get('/', requireAuth, async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    proUsers,
    coaches,
    newUsersThisMonth,
    newUsersThisWeek,
    totalRuns,
    runsAgg,
    recentUsers
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ subscriptionStatus: 'pro' }),
    User.countDocuments({ role: 'coach' }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    Run.countDocuments(),
    Run.aggregate([{ $group: { _id: null, totalKm: { $sum: '$distance' } } }]),
    User.find().sort({ createdAt: -1 }).limit(8).select('firstName lastName email role subscriptionStatus createdAt')
  ]);

  const totalKm = Math.round(runsAgg[0]?.totalKm || 0);

  // Inscriptions sur les 6 derniers mois
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyRaw = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthlyLabels = [];
  const monthlyCounts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyLabels.unshift(monthNames[d.getMonth()]);
    const entry = monthlyRaw.find(m => m._id.year === d.getFullYear() && m._id.month === (d.getMonth() + 1));
    monthlyCounts.unshift(entry ? entry.count : 0);
  }
  monthlyLabels.reverse();
  monthlyCounts.reverse();

  res.render('dashboard', {
    stats: {
      totalUsers, proUsers, coaches,
      athletes: totalUsers - coaches,
      newUsersThisMonth, newUsersThisWeek,
      totalRuns, totalKm,
      conversionRate: totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0.0'
    },
    monthlyLabels,
    monthlyCounts,
    recentUsers
  });
});

module.exports = router;
