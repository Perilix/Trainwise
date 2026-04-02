const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Run = require('../models/run.model');
const User = require('../models/user.model');

router.get('/', requireAuth, async (req, res) => {
  const { search = '', dateFrom = '', dateTo = '', analyzed = '', page = 1 } = req.query;
  const limit = 30;
  const skip = (parseInt(page) - 1) * limit;

  const filter = {};

  // Search by user
  if (search) {
    const users = await User.find({
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    filter.user = { $in: users.map(u => u._id) };
  }

  if (dateFrom) filter.date = { ...filter.date, $gte: new Date(dateFrom) };
  if (dateTo) filter.date = { ...filter.date, $lte: new Date(dateTo + 'T23:59:59') };
  if (analyzed === '1') filter.analysis = { $exists: true, $ne: null, $ne: '' };
  if (analyzed === '0') filter.$or = [{ analysis: { $exists: false } }, { analysis: null }, { analysis: '' }];

  const [runs, total] = await Promise.all([
    Run.find(filter).sort({ date: -1 }).skip(skip).limit(limit).populate('user', 'firstName lastName email'),
    Run.countDocuments(filter)
  ]);

  res.render('runs', {
    runs, total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    search, dateFrom, dateTo, analyzed
  });
});

module.exports = router;
