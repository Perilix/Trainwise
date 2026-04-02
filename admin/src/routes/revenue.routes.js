const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');

router.get('/', requireAuth, async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    proUsers,
    totalUsers,
    newProThisMonth,
    totalCoins,
    usersWithCoins,
    recentPro
  ] = await Promise.all([
    User.countDocuments({ subscriptionStatus: 'pro' }),
    User.countDocuments(),
    User.countDocuments({ subscriptionStatus: 'pro', createdAt: { $gte: startOfMonth } }),
    User.aggregate([{ $group: { _id: null, total: { $sum: '$trainCoins' } } }]),
    User.aggregate([
      { $group: { _id: null, avg: { $avg: '$trainCoins' }, min: { $min: '$trainCoins' }, max: { $max: '$trainCoins' } } }
    ]),
    User.find({ subscriptionStatus: 'pro' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('firstName lastName email subscriptionExpiry createdAt trainCoins')
  ]);

  // Pro growth over 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const proGrowthRaw = await User.aggregate([
    { $match: { subscriptionStatus: 'pro', createdAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const proLabels = [];
  const proCounts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    proLabels.push(monthNames[d.getMonth()]);
    const entry = proGrowthRaw.find(m => m._id.year === d.getFullYear() && m._id.month === (d.getMonth() + 1));
    proCounts.push(entry ? entry.count : 0);
  }

  const mrr = (proUsers * 9.99).toFixed(2);
  const conversionRate = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0.0';
  const totalCoinsVal = Math.round(totalCoins[0]?.total || 0);
  const avgCoins = Math.round(usersWithCoins[0]?.avg || 0);

  res.render('revenue', {
    stats: { proUsers, totalUsers, mrr, conversionRate, newProThisMonth, totalCoinsVal, avgCoins },
    proLabels,
    proCounts,
    recentPro
  });
});

module.exports = router;
