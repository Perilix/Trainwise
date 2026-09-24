/**
 * Les plans de l'abonnement coach.
 *
 * C'est la seule source de vérité : l'écran affiche ce que ce fichier décrit, et
 * les limites sont vérifiées ici, côté serveur. Un plan ne liste que des
 * fonctionnalités qui existent vraiment.
 *
 * Les identifiants de prix viennent de Stripe, par variable d'environnement :
 * rien de tarifaire n'est codé en dur côté client.
 */
const PLANS = [
  {
    id: 'decouverte',
    name: 'Découverte',
    pitch: 'Pour démarrer avec vos premiers athlètes.',
    monthly: 0,
    yearlyMonthly: 0,
    limits: { athletes: 3, groups: 0, customAlerts: false },
    features: ['Jusqu’à 3 athlètes', 'Planning et bibliothèque de séances', 'Messagerie avec vos athlètes'],
    prices: { monthly: null, yearly: null }
  },
  {
    id: 'coach',
    name: 'Coach',
    pitch: 'Le quotidien d’un coach indépendant.',
    monthly: 29,
    yearlyMonthly: 24,
    limits: { athletes: 15, groups: 3, customAlerts: false },
    features: ['Jusqu’à 15 athlètes', 'Jusqu’à 3 groupes d’athlètes', 'Séances types illimitées', 'Analyse des séances réalisées'],
    prices: { monthly: process.env.STRIPE_PRICE_COACH_MONTHLY, yearly: process.env.STRIPE_PRICE_COACH_YEARLY }
  },
  {
    id: 'studio',
    name: 'Studio',
    pitch: 'Pour un groupe ou une petite structure.',
    monthly: 59,
    yearlyMonthly: 49,
    limits: { athletes: 40, groups: null, customAlerts: true },
    features: ['Jusqu’à 40 athlètes', 'Tout le plan Coach', 'Groupes illimités', 'Alertes sur mesure : vous fixez les seuils'],
    prices: { monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY, yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY }
  },
  {
    id: 'club',
    name: 'Club',
    pitch: 'Club, team, fédération.',
    monthly: 119,
    yearlyMonthly: 99,
    limits: { athletes: 100, groups: null, customAlerts: true },
    features: ['Jusqu’à 100 athlètes', 'Tout le plan Studio', 'Accompagnement à la mise en route', 'Facturation sur demande'],
    prices: { monthly: process.env.STRIPE_PRICE_CLUB_MONTHLY, yearly: process.env.STRIPE_PRICE_CLUB_YEARLY }
  }
];

const FREE_PLAN_ID = 'decouverte';

const planById = (id) => PLANS.find((plan) => plan.id === id) || PLANS.find((plan) => plan.id === FREE_PLAN_ID);

/** L'identifiant de prix Stripe d'un plan, ou null si le plan est gratuit ou mal configuré. */
const priceIdOf = (planId, cycle) => planById(planId).prices[cycle === 'yearly' ? 'yearly' : 'monthly'] || null;

/** Le plan retrouvé depuis un identifiant de prix, au retour d'un webhook. */
const planByPriceId = (priceId) => {
  if (!priceId) return null;
  for (const plan of PLANS) {
    if (plan.prices.monthly === priceId) return { plan, cycle: 'monthly' };
    if (plan.prices.yearly === priceId) return { plan, cycle: 'yearly' };
  }
  return null;
};

/** Ce que l'écran a le droit de connaître : ni clés, ni identifiants Stripe. */
const publicPlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  pitch: plan.pitch,
  monthly: plan.monthly,
  yearlyMonthly: plan.yearlyMonthly,
  athletes: plan.limits.athletes,
  groups: plan.limits.groups,
  customAlerts: plan.limits.customAlerts,
  features: plan.features
});

module.exports = { PLANS, FREE_PLAN_ID, planById, priceIdOf, planByPriceId, publicPlan };
