const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    default: 'pending'
  },
  respondedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index pour rechercher efficacement les amitiés
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

// Méthode statique pour vérifier si deux utilisateurs sont amis
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
  return !!friendship;
};

// Méthode statique pour obtenir tous les amis d'un utilisateur
friendshipSchema.statics.getFriends = async function(userId) {
  const friendships = await this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  }).populate('requester recipient', 'firstName lastName email profilePicture');

  return friendships.map(f => {
    return f.requester._id.toString() === userId.toString()
      ? f.recipient
      : f.requester;
  });
};

// Méthode statique pour obtenir les demandes en attente reçues
friendshipSchema.statics.getPendingRequests = async function(userId) {
  return this.find({
    recipient: userId,
    status: 'pending'
  }).populate('requester', 'firstName lastName email profilePicture');
};

// Méthode statique pour obtenir les demandes envoyées en attente
friendshipSchema.statics.getSentRequests = async function(userId) {
  return this.find({
    requester: userId,
    status: 'pending'
  }).populate('recipient', 'firstName lastName email profilePicture');
};

module.exports = mongoose.model('Friendship', friendshipSchema);
