const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const CoachGroup = require('../models/coachGroup.model');
const { PLANS, FREE_PLAN_ID, planById, effectivePlan, isGranted, STATUS_LABELS, PLAN_COLORS } = require('../config/plans');

router.get('/', requireAuth, async (req, res) => {
  const coaches = await User.find({ role: 'coach' })
    .sort({ createdAt: -1 })
    .select('firstName lastName email createdAt trainCoins subscriptionStatus coachInviteCode coachBilling');

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

  const coachesWithStats = coaches.map(c => {
    const plan = effectivePlan(c.coachBilling);
    const accepted = statsMap[c._id.toString()]?.accepted || 0;
    return {
      ...c.toObject(),
      accepted,
      pending: statsMap[c._id.toString()]?.pending || 0,
      plan,
      granted: isGranted(c.coachBilling),
      // Un abonnement Stripe ne se touche pas d'ici : la ligne affiche un cadenas.
      managed: Boolean(c.coachBilling && c.coachBilling.subscriptionId),
      // Un coach au-dessus de son plan ne peut plus accepter personne : c'est
      // ce qu'on veut voir d'un coup d'œil depuis la liste.
      overLimit: plan.athletes !== null && accepted > plan.athletes
    };
  });

  res.render('coaches', {
    coaches: coachesWithStats,
    total: coaches.length,
    pendingCount,
    plans: PLANS,
    planColors: PLAN_COLORS,
    saved: req.query.plan === 'ok',
    blocked: req.query.plan === 'stripe'
  });
});

// Detail: athletes of a coach
router.get('/:id', requireAuth, async (req, res) => {
  const coach = await User.findById(req.params.id);
  if (!coach || coach.role !== 'coach') return res.redirect('/coaches');

  const [relations, groupCount] = await Promise.all([
    CoachAthlete.find({ coach: coach._id })
      .populate('athlete', 'firstName lastName email subscriptionStatus createdAt')
      .sort({ createdAt: -1 }),
    CoachGroup.countDocuments({ coach: coach._id })
  ]);

  const billing = coach.coachBilling || {};
  res.render('coach-detail', {
    coach,
    relations,
    groupCount,
    accepted: relations.filter(r => r.status === 'accepted').length,
    plans: PLANS,
    plan: effectivePlan(billing),
    billing,
    granted: isGranted(billing),
    statusLabels: STATUS_LABELS,
    planColors: PLAN_COLORS,
    saved: req.query.plan === 'ok',
    blocked: req.query.plan === 'stripe'
  });
});

// Poser un plan à la main : pour offrir un accès, ou pour tester avant Stripe.
router.post('/:id/plan', requireAuth, async (req, res) => {
  const coach = await User.findById(req.params.id);
  if (!coach || coach.role !== 'coach') return res.redirect('/coaches');

  // D'où vient la demande : la liste ou la fiche. On y retourne.
  const back = req.body.from === 'list' ? '/coaches' : `/coaches/${coach._id}`;

  // Un abonnement Stripe en cours ne se touche pas d'ici : le prochain webhook
  // écraserait le réglage, et le coach continuerait d'être prélevé.
  if (coach.coachBilling && coach.coachBilling.subscriptionId) {
    return res.redirect(`${back}?plan=stripe`);
  }

  const current = coach.coachBilling?.toObject?.() || {};
  const planId = planById(req.body.planId).id;
  const until = req.body.until ? new Date(req.body.until) : null;

  // Depuis la liste, seul le plan est envoyé : le cycle et l'échéance déjà
  // posés depuis la fiche ne doivent pas disparaître au passage.
  coach.coachBilling = {
    ...current,
    subscriptionId: null,
    planId,
    cycle: req.body.cycle === undefined ? current.cycle || 'monthly' : req.body.cycle === 'yearly' ? 'yearly' : 'monthly',
    status: planId === FREE_PLAN_ID ? 'canceled' : 'active',
    currentPeriodEnd:
      req.body.until === undefined ? current.currentPeriodEnd || null : until && !isNaN(until.getTime()) ? until : null,
    cancelAtPeriodEnd: false
  };
  await coach.save();

  res.redirect(`${back}?plan=ok`);
});

const ALLOWED_PACKAGES = ['invited', 'bronze', 'silver', 'gold'];
router.post('/:id/relations/:relationId/package', requireAuth, async (req, res) => {
  const { id, relationId } = req.params;
  const { packageType } = req.body;

  if (!ALLOWED_PACKAGES.includes(packageType)) {
    return res.redirect(`/coaches/${id}`);
  }

  await CoachAthlete.findOneAndUpdate(
    { _id: relationId, coach: id },
    { packageType }
  );

  res.redirect(`/coaches/${id}`);
});

module.exports = router;
