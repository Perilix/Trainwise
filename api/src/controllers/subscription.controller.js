const User = require('../models/user.model');
const ProcessedWebhookEvent = require('../models/processedWebhookEvent.model');
const { emitTrainCoinsUpdate } = require('../socket/index');
const { createNotification } = require('./notification.controller');

// Produits RevenueCat → coins offerts
const COIN_PRODUCTS = {
  trainwise_coins_10: 10,
  // Ancien ID `trainwise_coins_50` supprimé côté App Store (Product ID réservé à vie)
  // → recréé sous `trainwise_coins_50b`.
  trainwise_coins_50b: 50,
};

// Produits RevenueCat → durée abonnement Pro (en jours)
const PRO_PRODUCTS = {
  trainwise_pro_monthly: 31,
  trainwise_pro_annual: 366,
};

const formatDay = (date) => new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Trace de l'abonnement dans le centre de notifications, section Compte. */
const notifySubscription = (userId, action, title, message) =>
  createNotification({ recipient: userId, sender: null, type: 'subscription', action, title, message, actionUrl: '/profile' });

// GET /api/subscription/status
exports.getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const isPro = user.subscriptionStatus === 'pro' &&
                  user.subscriptionExpiry &&
                  new Date(user.subscriptionExpiry) > new Date();

    res.json({
      trainCoins: user.trainCoins,
      subscriptionStatus: isPro ? 'pro' : 'free',
      subscriptionExpiry: user.subscriptionExpiry,
      isPro
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/subscription/webhook  (RevenueCat → backend)
exports.revenueCatWebhook = async (req, res) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    // Fail closed : sans secret configuré, on refuse tout (sinon n'importe qui
    // pourrait s'auto-créditer coins/Pro en appelant ce endpoint).
    if (!secret) {
      console.error('REVENUECAT_WEBHOOK_SECRET manquant — webhook refusé.');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    if (req.headers['authorization'] !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event } = req.body;
    if (!event) return res.status(400).json({ error: 'No event' });

    const { id: eventId, type, app_user_id, product_id, expiration_at_ms } = event;

    // Idempotence : si RevenueCat relivre le même event, on ne le traite pas 2 fois
    // (sinon un pack de coins pourrait être crédité en double).
    if (eventId && await ProcessedWebhookEvent.exists({ eventId })) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const user = await User.findOne({
      $or: [
        { revenueCatUserId: app_user_id },
        { _id: app_user_id }
      ]
    });

    if (!user) return res.status(200).json({ received: true });

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        if (PRO_PRODUCTS[product_id] !== undefined) {
          user.subscriptionStatus = 'pro';
          user.subscriptionExpiry = expiration_at_ms
            ? new Date(expiration_at_ms)
            : new Date(Date.now() + PRO_PRODUCTS[product_id] * 24 * 60 * 60 * 1000);
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins, subscriptionStatus: 'pro', subscriptionExpiry: user.subscriptionExpiry });
          await notifySubscription(
            user._id,
            type === 'RENEWAL' ? 'subscription_renewed' : 'subscription_started',
            type === 'RENEWAL' ? 'Abonnement renouvelé' : 'Paiement effectué',
            `Ton abonnement Pro est actif jusqu'au ${formatDay(user.subscriptionExpiry)}.`
          );
        } else if (COIN_PRODUCTS[product_id] !== undefined) {
          user.trainCoins += COIN_PRODUCTS[product_id];
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins });
          await notifySubscription(user._id, 'coins_purchased', 'Paiement effectué', `${COIN_PRODUCTS[product_id]} TrainCoins ont été crédités sur ton compte.`);
        }
        break;
      }

      case 'EXPIRATION':
      case 'CANCELLATION':
      case 'BILLING_ISSUE': {
        if (PRO_PRODUCTS[product_id] !== undefined) {
          user.subscriptionStatus = 'free';
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins, subscriptionStatus: 'free' });
          // Un problème de paiement se corrige, une expiration se constate : deux messages.
          await notifySubscription(
            user._id,
            type === 'BILLING_ISSUE' ? 'billing_issue' : 'subscription_ended',
            type === 'BILLING_ISSUE' ? 'Problème de paiement' : 'Abonnement terminé',
            type === 'BILLING_ISSUE'
              ? 'Le renouvellement de ton abonnement Pro a échoué. Vérifie ton moyen de paiement pour ne pas perdre l\'accès.'
              : 'Ton abonnement Pro est arrivé à échéance. Tes données restent là, tu peux le reprendre quand tu veux.'
          );
        }
        break;
      }

      case 'NON_SUBSCRIPTION_PURCHASE': {
        if (COIN_PRODUCTS[product_id] !== undefined) {
          user.trainCoins += COIN_PRODUCTS[product_id];
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins });
          await notifySubscription(user._id, 'coins_purchased', 'Paiement effectué', `${COIN_PRODUCTS[product_id]} TrainCoins ont été crédités sur ton compte.`);
        }
        break;
      }
    }

    // Marque l'event comme traité (après application) pour bloquer les relivraisons.
    if (eventId) {
      try {
        await ProcessedWebhookEvent.create({ eventId, type });
      } catch (e) {
        // Course rare : un autre process l'a inséré entre-temps → sans gravité.
        if (e.code !== 11000) throw e;
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('RevenueCat webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/subscription/link-revenuecat  (sauvegarde le userId RevenueCat)
exports.linkRevenueCat = async (req, res) => {
  try {
    const { revenueCatUserId } = req.body;
    if (!revenueCatUserId) return res.status(400).json({ error: 'revenueCatUserId requis' });

    await User.findByIdAndUpdate(req.user.id, { revenueCatUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
