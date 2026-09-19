/**
 * Les plans de l'abonnement coach, vus depuis le back-office.
 *
 * Copie de `api/src/config/plans.js` : les deux services se déploient
 * séparément et ne partagent pas de code. Si un plan change là-bas, il change
 * ici — c'est l'API qui fait foi, le back-office ne fait qu'afficher et poser
 * une valeur à la main.
 */
const PLANS = [
  { id: 'decouverte', name: 'Découverte', athletes: 3, groups: 0, customAlerts: false, monthly: 0 },
  { id: 'coach', name: 'Coach', athletes: 15, groups: 3, customAlerts: false, monthly: 29 },
  { id: 'studio', name: 'Studio', athletes: 40, groups: null, customAlerts: true, monthly: 59 },
  { id: 'club', name: 'Club', athletes: null, groups: null, customAlerts: true, monthly: 119 }
];

const FREE_PLAN_ID = 'decouverte';

const planById = (id) => PLANS.find((plan) => plan.id === id) || PLANS[0];

const LIVE_STATUSES = ['active', 'trialing'];

/** Le plan qui s'applique vraiment, avec la même règle que l'API. */
const effectivePlan = (billing) => {
  if (!billing || !LIVE_STATUSES.includes(billing.status)) return planById(FREE_PLAN_ID);
  if (billing.currentPeriodEnd && new Date(billing.currentPeriodEnd).getTime() + 3 * 24 * 60 * 60 * 1000 < Date.now()) {
    return planById(FREE_PLAN_ID);
  }
  return planById(billing.planId || FREE_PLAN_ID);
};

/** Un plan posé à la main : pas d'abonnement Stripe derrière. */
const isGranted = (billing) => Boolean(billing && !billing.subscriptionId && billing.planId && billing.planId !== FREE_PLAN_ID);

const STATUS_LABELS = {
  active: 'Actif',
  trialing: 'Essai',
  past_due: 'Impayé',
  canceled: 'Résilié',
  incomplete: 'Incomplet'
};

const PLAN_COLORS = {
  decouverte: { bg: 'rgba(100,116,139,0.12)', ink: '#475569' },
  coach: { bg: 'rgba(0,166,251,0.12)', ink: '#0582ca' },
  studio: { bg: 'rgba(139,92,246,0.12)', ink: '#6d28d9' },
  club: { bg: 'rgba(16,185,129,0.12)', ink: '#059669' }
};

module.exports = { PLANS, FREE_PLAN_ID, planById, effectivePlan, isGranted, STATUS_LABELS, PLAN_COLORS };
