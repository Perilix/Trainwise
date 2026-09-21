const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const StrengthSession = require('../models/strengthSession.model');
const User = require('../models/user.model');
require('../models/exercise.model');

router.get('/', requireAuth, async (req, res) => {
  const { search = '', origin = '', dateFrom = '', dateTo = '', page = 1 } = req.query;
  const limit = 30;
  const skip = (parseInt(page) - 1) * limit;

  const filter = {};

  if (search) {
    const users = await User.find({
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    filter.user = { $in: users.map((u) => u._id) };
  }

  // Importée de Strava, ou saisie dans l'app.
  if (origin === 'strava') filter.stravaActivityId = { $ne: null };
  if (origin === 'app') filter.stravaActivityId = null;

  if (dateFrom) filter.date = { ...filter.date, $gte: new Date(dateFrom) };
  if (dateTo) filter.date = { ...filter.date, $lte: new Date(dateTo + 'T23:59:59') };

  const [sessions, total, fromStrava] = await Promise.all([
    StrengthSession.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .populate('exercises.exercise', 'name')
      .lean(),
    StrengthSession.countDocuments(filter),
    StrengthSession.countDocuments({ stravaActivityId: { $ne: null } })
  ]);

  res.render('strength', {
    sessions,
    total,
    fromStrava,
    page: parseInt(page),
    pages: Math.ceil(total / limit) || 1,
    search, origin, dateFrom, dateTo
  });
});

router.post('/:id/delete', requireAuth, async (req, res) => {
  await StrengthSession.findByIdAndDelete(req.params.id);
  res.redirect('back');
});

module.exports = router;
