const User = require('../models/user.model');
const { emitTrainCoinsUpdate } = require('../socket/index');

// Produits RevenueCat → coins offerts
const COIN_PRODUCTS = {
  trainwise_coins_10: 10,
  trainwise_coins_50: 50,
};

// Produits RevenueCat → durée abonnement Pro (en jours)
const PRO_PRODUCTS = {
  trainwise_pro_monthly: 31,
  trainwise_pro_annual: 366,
};

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
    if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event } = req.body;
    if (!event) return res.status(400).json({ error: 'No event' });

    const { type, app_user_id, product_id, expiration_at_ms } = event;
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
        } else if (COIN_PRODUCTS[product_id] !== undefined) {
          user.trainCoins += COIN_PRODUCTS[product_id];
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins });
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
        }
        break;
      }

      case 'NON_SUBSCRIPTION_PURCHASE': {
        if (COIN_PRODUCTS[product_id] !== undefined) {
          user.trainCoins += COIN_PRODUCTS[product_id];
          await user.save({ validateBeforeSave: false });
          emitTrainCoinsUpdate(user._id, { trainCoins: user.trainCoins });
        }
        break;
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
