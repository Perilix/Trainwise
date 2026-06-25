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

// Consulter une course (détail complet)
router.get('/:id', requireAuth, async (req, res) => {
  // .lean() pour récupérer tous les champs stockés (runBlocks, plannedSnapshot, etc.),
  // même s'ils ne sont pas déclarés dans le schéma admin minimal.
  const run = await Run.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .lean();

  if (!run) {
    return res.status(404).render('run-detail', { run: null });
  }

  res.render('run-detail', { run });
});

// Supprimer une course
router.post('/:id/delete', requireAuth, async (req, res) => {
  await Run.findByIdAndDelete(req.params.id);
  res.redirect('/runs');
});

module.exports = router;
