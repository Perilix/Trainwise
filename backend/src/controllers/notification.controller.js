const Notification = require('../models/notification.model');
const { getIO } = require('../socket/index');

// Créer une notification (fonction utilitaire)
exports.createNotification = async ({ recipient, sender, type, action, title, message, actionUrl }) => {
  try {
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      action,
      title,
      message,
      actionUrl
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'firstName lastName profilePicture');

    // Émettre en temps réel via socket
    const io = getIO();
    if (io) {
      io.to(`user:${recipient.toString()}`).emit('notification:new', populatedNotification);
    }

    return populatedNotification;
  } catch (error) {
    console.error('Erreur création notification:', error);
    return null;
  }
};

// Obtenir les notifications de l'utilisateur
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ recipient: req.user._id });

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir le nombre de notifications non lues
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marquer une notification comme lue
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marquer toutes les notifications comme lues
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Supprimer une notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
