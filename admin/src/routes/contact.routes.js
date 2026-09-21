const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ContactMessage = require('../models/contactMessage.model');

const STATUSES = ['nouveau', 'en_cours', 'traite'];
const SUBJECTS = ['question', 'bug', 'compte', 'donnees', 'suggestion', 'autre'];

const SUBJECT_LABELS = {
  question: 'Question',
  bug: 'Problème technique',
  compte: 'Mon compte',
  donnees: 'Mes données',
  suggestion: 'Suggestion',
  autre: 'Autre'
};

const STATUS_STYLE = {
  nouveau: { label: 'Nouveau', bg: 'rgba(245,158,11,0.12)', ink: '#92400e' },
  en_cours: { label: 'En cours', bg: 'rgba(0,166,251,0.12)', ink: '#0582ca' },
  traite: { label: 'Traité', bg: 'rgba(16,185,129,0.12)', ink: '#059669' }
};

router.get('/', requireAuth, async (req, res) => {
  const { status = '', subject = '', search = '', page = 1 } = req.query;
  const limit = 20;
  const skip = (parseInt(page) - 1) * limit;

  const filter = {};
  if (STATUSES.includes(status)) filter.status = status;
  if (SUBJECTS.includes(subject)) filter.subject = subject;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } }
    ];
  }

  const [items, total, counts] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'firstName lastName email role'),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);

  const statusCounts = { nouveau: 0, en_cours: 0, traite: 0 };
  counts.forEach((c) => { if (c._id in statusCounts) statusCounts[c._id] = c.n; });

  res.render('contact', {
    items,
    total,
    statusCounts,
    page: parseInt(page),
    pages: Math.ceil(total / limit) || 1,
    status, subject, search,
    statuses: STATUSES,
    subjectLabels: SUBJECT_LABELS,
    statusStyle: STATUS_STYLE,
    saved: req.query.saved === '1'
  });
});

// Avancement d'un message : nouveau → en cours → traité.
router.post('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (STATUSES.includes(status)) {
    await ContactMessage.findByIdAndUpdate(req.params.id, {
      status,
      handledAt: status === 'traite' ? new Date() : null
    });
  }
  res.redirect('back');
});

router.post('/:id/delete', requireAuth, async (req, res) => {
  await ContactMessage.findByIdAndDelete(req.params.id);
  res.redirect('/contact');
});

module.exports = router;
