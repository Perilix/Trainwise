const User = require('../models/user.model');
const { emitTrainCoinsUpdate } = require('../socket/index');

/**
 * Middleware factory — vérifie que l'utilisateur peut utiliser une feature IA.
 * Priorité : abonnement Pro actif > TrainCoins > 402
 * @param {number} coinCost - nombre de TrainCoins consommés si pas Pro
 */
const checkAIAccess = (coinCost = 1) => async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });

    // Abonnement Pro actif → accès gratuit
    if (
      user.subscriptionStatus === 'pro' &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) > new Date()
    ) {
      return next();
    }

    // TrainCoins suffisants → décrémenter atomiquement pour éviter les requêtes simultanées
    const updated = await User.findOneAndUpdate(
      { _id: user._id, trainCoins: { $gte: coinCost } },
      { $inc: { trainCoins: -coinCost } },
      { new: true }
    );
    if (updated) {
      res.setHeader('X-TrainCoins-Remaining', updated.trainCoins);
      req.trainCoinsRemaining = updated.trainCoins;
      emitTrainCoinsUpdate(updated._id, { trainCoins: updated.trainCoins });
      return next();
    }

    // Aucun accès
    return res.status(402).json({
      error: 'INSUFFICIENT_COINS',
      trainCoins: user.trainCoins,
      coinCost,
      message: `Il vous faut ${coinCost} TrainCoin${coinCost > 1 ? 's' : ''} pour cette action.`
    });

  } catch (err) {
    next(err);
  }
};

module.exports = checkAIAccess;
