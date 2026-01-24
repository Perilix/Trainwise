const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  name: {
    type: String,
    trim: true
  },
  lastMessage: {
    content: {
      type: String,
      default: ''
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: null
    },
    type: {
      type: String,
      enum: ['text', 'image', 'document'],
      default: 'text'
    }
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });

// Get or create a direct conversation between two users
conversationSchema.statics.findOrCreateDirect = async function(userId1, userId2) {
  const participants = [userId1, userId2].sort();

  let conversation = await this.findOne({
    type: 'direct',
    participants: { $all: participants, $size: 2 }
  }).populate('participants', 'firstName lastName email');

  if (!conversation) {
    conversation = await this.create({
      type: 'direct',
      participants
    });
    conversation = await this.findById(conversation._id)
      .populate('participants', 'firstName lastName email');
  }

  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);
