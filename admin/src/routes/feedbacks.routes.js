const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const BetaFeedback = require('../models/betaFeedback.model');
const User = require('../models/user.model');

const VALID_STATUS = ['triage', 'open', 'prog', 'planned', 'fixed', 'closed'];
const VALID_TYPE   = ['bug', 'ui', 'perf', 'idea'];
const VALID_SEV    = ['low', 'med', 'high', 'crit'];

router.get('/', requireAuth, async (req, res) => {
  const { status = '', type = '', severity = '', search = '', page = 1 } = req.query;
  const limit = 20;
  const skip = (parseInt(page) - 1) * limit;

  const filter = {};
  if (status   && VALID_STATUS.includes(status)) filter.status = status;
  if (type     && VALID_TYPE.includes(type))     filter.type = type;
  if (severity && VALID_SEV.includes(severity))  filter.severity = severity;
  if (search) {
    filter.$or = [
      { ticketId: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [items, total, counts] = await Promise.all([
    BetaFeedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email'),
    BetaFeedback.countDocuments(filter),
    BetaFeedback.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } }
    ])
  ]);

  const statusCounts = { triage: 0, open: 0, prog: 0, planned: 0, fixed: 0, closed: 0 };
  counts.forEach(c => { if (c._id in statusCounts) statusCounts[c._id] = c.n; });

  const totalAll = await BetaFeedback.countDocuments();

  res.render('feedbacks', {
    items,
    total,
    totalAll,
    statusCounts,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    status, type, severity, search,
    success: req.query.success || null,
    error: null
  });
});

router.post('/:id/status', requireAuth, async (req, res) => {
  const { status, publicOnCommunity } = req.body;
  const update = {};
  if (status && VALID_STATUS.includes(status)) update.status = status;
  if (publicOnCommunity !== undefined) {
    update.publicOnCommunity = publicOnCommunity === 'true' || publicOnCommunity === 'on' || publicOnCommunity === true;
  }
  await BetaFeedback.findByIdAndUpdate(req.params.id, update);
  const ref = req.get('Referer') || '/feedbacks';
  res.redirect(ref.includes('?') ? `${ref}&success=updated` : `${ref}?success=updated`);
});

router.post('/:id/delete', requireAuth, async (req, res) => {
  await BetaFeedback.findByIdAndDelete(req.params.id);
  res.redirect('/feedbacks?success=deleted');
});

module.exports = router;
