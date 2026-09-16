const User = require('../models/user.model');

// Sauvegarder le push token
exports.savePushToken = async (req, res) => {
  try {
    const { pushToken, platform } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: 'Push token requis' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        pushToken,
        pushPlatform: platform || 'ios'
      },
      { new: true }
    );

    res.json({ message: 'Push token enregistré', pushToken: user.pushToken });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ error: error.message });
  }
};

// Supprimer le push token
exports.removePushToken = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        pushToken: null,
        pushPlatform: null
      }
    );

    res.json({ message: 'Push token supprimé' });
  } catch (error) {
    console.error('Error removing push token:', error);
    res.status(500).json({ error: error.message });
  }
};
