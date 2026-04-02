const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Run = require('../models/run.model');
const User = require('../models/user.model');

router.get('/', requireAuth, async (req, res) => {
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7); startOfWeek.setHours(0,0,0,0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 13); fourteenDaysAgo.setHours(0,0,0,0);

  const [
    totalRuns,
    analyzedRuns,
    analyzedThisWeek,
    analyzedThisMonth,
    dailyRaw,
    topUsersRaw
  ] = await Promise.all([
    Run.countDocuments(),
    Run.countDocuments({ analysis: { $exists: true, $ne: null, $ne: '' } }),
    Run.countDocuments({ analysis: { $exists: true, $ne: null, $ne: '' }, date: { $gte: startOfWeek } }),
    Run.countDocuments({ analysis: { $exists: true, $ne: null, $ne: '' }, date: { $gte: startOfMonth } }),
    Run.aggregate([
      { $match: { analysis: { $exists: true, $ne: null, $ne: '' }, date: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Run.aggregate([
      { $match: { analysis: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' }
    ])
  ]);

  // Build daily chart — last 14 days
  const dailyLabels = [];
  const dailyCounts = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyLabels.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    const entry = dailyRaw.find(x => x._id === key);
    dailyCounts.push(entry ? entry.count : 0);
  }

  const analysisRate = totalRuns > 0 ? ((analyzedRuns / totalRuns) * 100).toFixed(1) : '0.0';

  res.render('ai', {
    stats: { totalRuns, analyzedRuns, analysisRate, analyzedThisWeek, analyzedThisMonth },
    dailyLabels,
    dailyCounts,
    topUsers: topUsersRaw
  });
});

module.exports = router;
