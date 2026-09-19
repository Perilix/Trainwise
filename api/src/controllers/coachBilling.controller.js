const Stripe = require('stripe');

const User = require('../models/user.model');
const { PLANS, FREE_PLAN_ID, planById, planByPriceId, priceIdOf, publicPlan } = require('../config/plans');
const { groupRoom, countAthletes, planOf } = require('../services/coachPlan.service');
const { DEFAULT_RULES } = require('../services/athleteStatus.service');

let client = null;

/** Le client Stripe, créé au premier appel. Sans clé, on reste en lecture seule. */
const stripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
};

const webUrl = () => (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

/** Le client Stripe du coach, créé à la volée la première fois qu'il paie. */
const customerIdOf = async (user) => {
  if (user.coachBilling?.customerId) return user.coachBilling.customerId;
  if (!user.coachBilling) user.coachBilling = {};
  const customer = await stripe().customers.create({
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    metadata: { userId: user._id.toString() }
  });
  user.coachBilling.customerId = customer.id;
  await user.save();
  return customer.id;
};

const money = (amount) => (typeof amount === 'number' ? Math.round(amount) / 100 : null);

// GET /api/coach/billing
exports.getBilling = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('coachBilling email firstName lastName');
    if (!user) return res.status(404).json({ error: 'Compte introuvable' });

    const plan = planOf(user);
    const billing = user.coachBilling || {};
    const [athletes, groups] = await Promise.all([countAthletes(user._id), groupRoom(user._id)]);

    let card = null;
    let invoices = [];

    // Les factures et la carte vivent chez Stripe : on ne les recopie pas.
    if (stripe() && billing.customerId) {
      const [list, customer] = await Promise.all([
        stripe().invoices.list({ customer: billing.customerId, limit: 6 }),
        stripe().customers.retrieve(billing.customerId, { expand: ['invoice_settings.default_payment_method'] })
      ]);
      invoices = list.data.map((invoice) => ({
        id: invoice.number || invoice.id,
        date: invoice.created ? new Date(invoice.created * 1000).toISOString().slice(0, 10) : null,
        label: invoice.lines?.data?.[0]?.description || 'Abonnement Trainwise',
        amount: money(invoice.total),
        status: invoice.status === 'paid' ? 'paid' : 'pending',
        url: invoice.hosted_invoice_url || null
      }));
      const method = customer?.invoice_settings?.default_payment_method;
      if (method?.card) {
        card = {
          brand: method.card.brand,
          last4: method.card.last4,
          expires: `${String(method.card.exp_month).padStart(2, '0')}/${String(method.card.exp_year).slice(-2)}`
        };
      }
    }

    res.json({
      configured: Boolean(stripe()),
      plans: PLANS.map(publicPlan),
      subscription: {
        planId: plan.id,
        cycle: billing.cycle || 'monthly',
        status: billing.status || 'active',
        renewsOn: billing.currentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(billing.cancelAtPeriodEnd)
      },
      usage: {
        athletes,
        athleteLimit: plan.limits.athletes,
        groups: groups.used,
        groupLimit: plan.limits.groups
      },
      card,
      invoices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/coach/billing/checkout — ouvre le paiement chez Stripe.
exports.createCheckout = async (req, res) => {
  try {
    if (!stripe()) return res.status(503).json({ error: "Le paiement n'est pas encore configuré." });

    const cycle = req.body.cycle === 'yearly' ? 'yearly' : 'monthly';
    const plan = planById(req.body.planId);
    if (plan.id === FREE_PLAN_ID) return res.status(400).json({ error: 'Le plan Découverte est gratuit.' });

    const priceId = priceIdOf(plan.id, cycle);
    if (!priceId) return res.status(503).json({ error: `Le tarif ${plan.name} n'est pas encore configuré.` });

    // On ne laisse pas descendre sous le nombre d'athlètes déjà suivis.
    const used = await countAthletes(req.user._id);
    if (plan.limits.athletes !== null && used > plan.limits.athletes) {
      return res.status(400).json({ error: `Ce plan couvre ${plan.limits.athletes} athlètes, vous en suivez ${used}.` });
    }

    const user = await User.findById(req.user._id).select('coachBilling email firstName lastName');
    const customer = await customerIdOf(user);
    const back = `${webUrl()}/coach/abonnement`;

    // Un abonnement en cours se change dans le portail, pas par un second paiement.
    if (user.coachBilling?.subscriptionId && ['active', 'trialing', 'past_due'].includes(user.coachBilling.status)) {
      const session = await stripe().billingPortal.sessions.create({
        customer,
        return_url: back,
        flow_data: {
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: user.coachBilling.subscriptionId,
            items: [{ id: await currentItemId(user.coachBilling.subscriptionId), price: priceId, quantity: 1 }]
          },
          after_completion: { type: 'redirect', redirect: { return_url: back } }
        }
      });
      return res.json({ url: session.url });
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user._id.toString(),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { userId: user._id.toString(), planId: plan.id, cycle } },
      allow_promotion_codes: true,
      locale: 'fr',
      integration_identifier: 'trainwise-coach-qkvzmhrd',
      success_url: `${back}?paiement=ok`,
      cancel_url: `${back}?paiement=annule`
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/** La ligne de l'abonnement en cours : Stripe la remplace, il ne l'ajoute pas. */
const currentItemId = async (subscriptionId) => {
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  return subscription.items.data[0].id;
};

// POST /api/coach/billing/portal — carte, factures, résiliation : tout est chez Stripe.
exports.createPortal = async (req, res) => {
  try {
    if (!stripe()) return res.status(503).json({ error: "Le paiement n'est pas encore configuré." });

    const user = await User.findById(req.user._id).select('coachBilling email firstName lastName');
    if (!user.coachBilling?.customerId) return res.status(400).json({ error: 'Aucun abonnement à gérer.' });

    const session = await stripe().billingPortal.sessions.create({
      customer: user.coachBilling.customerId,
      return_url: `${webUrl()}/coach/abonnement`
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/** Recopie l'état d'un abonnement Stripe sur le coach correspondant. */
const applySubscription = async (subscription) => {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const match = planByPriceId(priceId);

  // Le client Stripe est le lien qui fait foi ; les métadonnées ne servent que
  // de secours, au tout premier paiement.
  const user =
    (await User.findOne({ 'coachBilling.customerId': subscription.customer })) ||
    (subscription.metadata?.userId ? await User.findById(subscription.metadata.userId) : null);
  if (!user) return;

  const ended = ['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status);
  const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end;

  user.coachBilling = {
    ...(user.coachBilling?.toObject?.() || user.coachBilling || {}),
    customerId: subscription.customer,
    subscriptionId: ended ? null : subscription.id,
    planId: ended ? FREE_PLAN_ID : match?.plan.id || user.coachBilling?.planId || FREE_PLAN_ID,
    cycle: match?.cycle || user.coachBilling?.cycle || 'monthly',
    status: ended ? 'canceled' : subscription.status === 'trialing' ? 'trialing' : subscription.status === 'past_due' ? 'past_due' : 'active',
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
  };
  await user.save();
};

// POST /api/stripe/webhook — corps brut, signature vérifiée : c'est lui qui fait foi.
exports.webhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe() || !secret) return res.status(503).send('Stripe non configuré');

  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (error) {
    return res.status(400).send('Signature invalide');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription) {
          await applySubscription(await stripe().subscriptions.retrieve(session.subscription));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId =
          invoice.subscription || invoice.parent?.subscription_details?.subscription || invoice.lines?.data?.[0]?.subscription;
        if (subscriptionId) {
          await applySubscription(await stripe().subscriptions.retrieve(subscriptionId));
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    res.status(500).send('Traitement impossible');
  }
};

// GET /api/coach/alert-rules
exports.getAlertRules = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('coachAlertRules coachBilling').lean();
    const plan = planOf(user);
    res.json({ rules: { ...DEFAULT_RULES, ...(user.coachAlertRules || {}) }, editable: plan.limits.customAlerts, planName: plan.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const NUMBER_RULES = {
  inactivityOrange: [1, 60],
  inactivityRed: [1, 90],
  skippedOrange: [1, 20],
  skippedRed: [1, 30],
  feelingOrange: [1, 10],
  feelingRed: [1, 10],
  volumeDropPercent: [10, 90]
};

// PUT /api/coach/alert-rules — réservé aux plans qui l'incluent.
exports.setAlertRules = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const plan = planOf(user);
    if (!plan.limits.customAlerts) {
      return res.status(402).json({ error: 'Les alertes sur mesure font partie du plan Studio.', plan: 'studio' });
    }

    const rules = { ...DEFAULT_RULES, ...(user.coachAlertRules?.toObject?.() || {}) };
    for (const [key, [min, max]] of Object.entries(NUMBER_RULES)) {
      if (req.body[key] === undefined) continue;
      const value = Number(req.body[key]);
      if (!Number.isFinite(value)) return res.status(400).json({ error: `Valeur invalide pour ${key}.` });
      rules[key] = Math.min(max, Math.max(min, Math.round(value)));
    }
    if (req.body.volumeDropEnabled !== undefined) rules.volumeDropEnabled = Boolean(req.body.volumeDropEnabled);

    // Le rouge doit rester plus sévère que l'orange, sinon l'orange ne sort jamais.
    if (rules.inactivityRed <= rules.inactivityOrange) rules.inactivityRed = rules.inactivityOrange + 1;
    if (rules.skippedRed <= rules.skippedOrange) rules.skippedRed = rules.skippedOrange + 1;
    if (rules.feelingRed >= rules.feelingOrange) rules.feelingRed = Math.max(1, rules.feelingOrange - 1);

    user.coachAlertRules = rules;
    await user.save();
    res.json({ rules: user.coachAlertRules, editable: true, planName: plan.name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
