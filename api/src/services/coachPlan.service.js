const CoachAthlete = require('../models/coachAthlete.model');
const CoachGroup = require('../models/coachGroup.model');
const User = require('../models/user.model');
const { FREE_PLAN_ID, planById } = require('../config/plans');

// Un abonnement impayé ou résilié ne donne plus accès au plan payé.
const LIVE_STATUSES = ['active', 'trialing'];

/**
 * Le plan effectif d'un coach : celui qu'il paie, ou Découverte si l'abonnement
 * n'est pas en règle ou si la période est passée sans renouvellement.
 */
const planOf = (user) => {
  const billing = user?.coachBilling;
  if (!billing || !LIVE_STATUSES.includes(billing.status)) return planById(FREE_PLAN_ID);
  if (billing.currentPeriodEnd && new Date(billing.currentPeriodEnd).getTime() + 3 * 24 * 60 * 60 * 1000 < Date.now()) {
    // Trois jours de marge : le temps qu'un renouvellement arrive par webhook.
    return planById(FREE_PLAN_ID);
  }
  return planById(billing.planId || FREE_PLAN_ID);
};

const planOfId = async (coachId) => {
  const user = await User.findById(coachId).select('coachBilling').lean();
  return planOf(user);
};

const countAthletes = (coachId) => CoachAthlete.countDocuments({ coach: coachId, status: 'accepted' });

/** Reste-t-il de la place pour un athlète de plus ? */
const athleteRoom = async (coachId) => {
  const plan = await planOfId(coachId);
  const limit = plan.limits.athletes;
  const used = await countAthletes(coachId);
  return { ok: limit === null || used < limit, plan, limit, used };
};

/** Reste-t-il de la place pour un groupe de plus ? */
const groupRoom = async (coachId) => {
  const plan = await planOfId(coachId);
  const limit = plan.limits.groups;
  const used = await CoachGroup.countDocuments({ coach: coachId });
  return { ok: limit === null || used < limit, plan, limit, used };
};

module.exports = { planOf, planOfId, countAthletes, athleteRoom, groupRoom };
