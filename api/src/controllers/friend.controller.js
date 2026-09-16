const Friendship = require('../models/friendship.model');
const User = require('../models/user.model');
const { createNotification } = require('./notification.controller');
const { isUserOnline, getIO } = require('../socket/index');

// Helper pour émettre un événement d'ami
function emitFriendEvent(userId, event, data) {
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit(event, data);
    }
  } catch (e) {
    // Socket non initialisé
  }
}

// Envoyer une demande d'ami
exports.sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user._id;

    // Vérifier qu'on n'envoie pas une demande à soi-même
    if (userId === requesterId.toString()) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter en ami' });
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Vérifier si une demande existe déjà
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: userId },
        { requester: userId, recipient: requesterId }
      ]
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        return res.status(400).json({ error: 'Vous êtes déjà amis' });
      }
      if (existingFriendship.status === 'pending') {
        // Si c'est l'autre qui a envoyé la demande, on l'accepte automatiquement
        if (existingFriendship.recipient.toString() === requesterId.toString()) {
          existingFriendship.status = 'accepted';
          existingFriendship.respondedAt = new Date();
          await existingFriendship.save();

          // Notifier l'autre utilisateur
          await createFriendNotification(
            existingFriendship.requester,
            requesterId,
            'friend_accepted',
            req.user
          );

          return res.json({ message: 'Demande acceptée', friendship: existingFriendship });
        }
        return res.status(400).json({ error: 'Demande déjà envoyée' });
      }
      if (existingFriendship.status === 'rejected') {
        // Permettre de renvoyer une demande si elle a été refusée
        existingFriendship.requester = requesterId;
        existingFriendship.recipient = userId;
        existingFriendship.status = 'pending';
        existingFriendship.respondedAt = null;
        await existingFriendship.save();

        await createFriendNotification(userId, requesterId, 'friend_request', req.user);

        return res.json({ message: 'Demande envoyée', friendship: existingFriendship });
      }
      if (existingFriendship.status === 'blocked') {
        return res.status(403).json({ error: 'Action non autorisée' });
      }
    }

    // Créer la nouvelle demande
    const friendship = await Friendship.create({
      requester: requesterId,
      recipient: userId,
      status: 'pending'
    });

    // Créer une notification pour le destinataire
    await createFriendNotification(userId, requesterId, 'friend_request', req.user);

    // Émettre un événement socket pour mettre à jour la liste des demandes
    emitFriendEvent(userId, 'friend:request', { friendship });

    res.status(201).json({ message: 'Demande envoyée', friendship });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: error.message });
  }
};

// Répondre à une demande d'ami
exports.respondToFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { accept } = req.body;
    const userId = req.user._id;

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    // Vérifier que l'utilisateur est bien le destinataire
    if (friendship.recipient.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    friendship.status = accept ? 'accepted' : 'rejected';
    friendship.respondedAt = new Date();
    await friendship.save();

    // Notifier le demandeur
    await createFriendNotification(
      friendship.requester,
      userId,
      accept ? 'friend_accepted' : 'friend_rejected',
      req.user
    );

    // Émettre un événement socket pour mettre à jour les listes
    emitFriendEvent(friendship.requester.toString(), 'friend:response', {
      friendship,
      accepted: accept
    });

    res.json({
      message: accept ? 'Demande acceptée' : 'Demande refusée',
      friendship
    });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtenir la liste des amis
exports.getFriends = async (req, res) => {
  try {
    const friends = await Friendship.getFriends(req.user._id);

    // Ajouter le statut en ligne
    const friendsWithStatus = friends.map(friend => ({
      ...friend.toObject(),
      isOnline: isUserOnline(friend._id)
    }));

    res.json(friendsWithStatus);
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtenir les demandes en attente reçues
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await Friendship.getPendingRequests(req.user._id);
    res.json(requests);
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtenir les demandes envoyées en attente
exports.getSentRequests = async (req, res) => {
  try {
    const requests = await Friendship.getSentRequests(req.user._id);
    res.json(requests);
  } catch (error) {
    console.error('Error getting sent requests:', error);
    res.status(500).json({ error: error.message });
  }
};

// Supprimer un ami
exports.removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const friendship = await Friendship.findOneAndDelete({
      $or: [
        { requester: currentUserId, recipient: userId, status: 'accepted' },
        { requester: userId, recipient: currentUserId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Amitié non trouvée' });
    }

    res.json({ message: 'Ami supprimé' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: error.message });
  }
};

// Annuler une demande envoyée
exports.cancelFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    const friendship = await Friendship.findOneAndDelete({
      requester: req.user._id,
      recipient: userId,
      status: 'pending'
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    res.json({ message: 'Demande annulée' });
  } catch (error) {
    console.error('Error canceling friend request:', error);
    res.status(500).json({ error: error.message });
  }
};

// Rechercher des utilisateurs (pour ajouter des amis)
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Trouver les utilisateurs correspondants
    const users = await User.find({
      _id: { $ne: currentUserId },
      role: { $ne: 'coach' }, // Exclure les coachs de la recherche d'amis
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
      .select('firstName lastName email profilePicture')
      .limit(20);

    // Récupérer les relations existantes
    const userIds = users.map(u => u._id);
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId, recipient: { $in: userIds } },
        { requester: { $in: userIds }, recipient: currentUserId }
      ]
    });

    // Créer un map des relations
    const relationshipMap = {};
    friendships.forEach(f => {
      const otherId = f.requester.toString() === currentUserId.toString()
        ? f.recipient.toString()
        : f.requester.toString();
      relationshipMap[otherId] = {
        status: f.status,
        isRequester: f.requester.toString() === currentUserId.toString(),
        friendshipId: f._id
      };
    });

    // Ajouter le statut de relation à chaque utilisateur
    const usersWithRelation = users.map(user => ({
      ...user.toObject(),
      isOnline: isUserOnline(user._id),
      friendship: relationshipMap[user._id.toString()] || null
    }));

    res.json(usersWithRelation);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
};

// Vérifier le statut d'amitié avec un utilisateur
exports.getFriendshipStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const friendship = await Friendship.findOne({
      $or: [
        { requester: currentUserId, recipient: userId },
        { requester: userId, recipient: currentUserId }
      ]
    });

    if (!friendship) {
      return res.json({ status: 'none' });
    }

    res.json({
      status: friendship.status,
      isRequester: friendship.requester.toString() === currentUserId.toString(),
      friendshipId: friendship._id
    });
  } catch (error) {
    console.error('Error getting friendship status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Récupérer le profil d'un ami
exports.getFriendProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Vérifier qu'ils sont amis
    const areFriends = await Friendship.areFriends(currentUserId, userId);
    if (!areFriends) {
      return res.status(403).json({ error: 'Vous devez être amis pour voir ce profil' });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(userId)
      .select('firstName lastName email profilePicture runningLevel goal weeklyFrequency createdAt');

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Récupérer les stats (runs)
    const Run = require('../models/run.model');
    const runs = await Run.find({ user: userId });

    const stats = {
      totalRuns: runs.length,
      totalDistance: runs.reduce((sum, run) => sum + (run.distance || 0), 0),
      totalDuration: runs.reduce((sum, run) => sum + (run.duration || 0), 0)
    };

    res.json({ user, stats });
  } catch (error) {
    console.error('Error getting friend profile:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper pour créer une notification d'ami
async function createFriendNotification(recipientId, senderId, action, senderUser) {
  const titles = {
    friend_request: 'Nouvelle demande d\'ami',
    friend_accepted: 'Demande acceptée',
    friend_rejected: 'Demande refusée'
  };

  const messages = {
    friend_request: `${senderUser.firstName} ${senderUser.lastName} souhaite vous ajouter en ami`,
    friend_accepted: `${senderUser.firstName} ${senderUser.lastName} a accepté votre demande d'ami`,
    friend_rejected: `${senderUser.firstName} ${senderUser.lastName} a refusé votre demande d'ami`
  };

  // Utiliser la fonction centralisée qui gère aussi l'émission socket
  return createNotification({
    recipient: recipientId,
    sender: senderId,
    type: 'friend',
    action,
    title: titles[action],
    message: messages[action],
    actionUrl: action === 'friend_request' ? '/friends' : null
  });
}
