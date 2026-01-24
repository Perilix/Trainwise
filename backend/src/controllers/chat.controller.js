const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const { cloudinary } = require('../config/cloudinary');
const { isUserOnline } = require('../socket/index');

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
      .populate('participants', 'firstName lastName email profilePicture')
      .populate('lastMessage.sender', 'firstName lastName profilePicture')
      .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 });

    // Add online status and format response
    const formattedConversations = conversations.map(conv => {
      const convObj = conv.toObject();

      // Get the other participant for direct conversations
      if (conv.type === 'direct') {
        const otherParticipant = conv.participants.find(
          p => p._id.toString() !== req.user._id.toString()
        );
        if (otherParticipant) {
          convObj.otherParticipant = {
            ...otherParticipant.toObject(),
            isOnline: isUserOnline(otherParticipant._id)
          };
        }
      }

      // Get unread count for current user
      convObj.unreadCount = conv.unreadCounts.get(req.user._id.toString()) || 0;

      return convObj;
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get or create a direct conversation with another user
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Vous ne pouvez pas demarrer une conversation avec vous-meme' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }

    const conversation = await Conversation.findOrCreateDirect(req.user._id, userId);

    // Add online status
    const convObj = conversation.toObject();
    const otherParticipant = conversation.participants.find(
      p => p._id.toString() !== req.user._id.toString()
    );
    if (otherParticipant) {
      convObj.otherParticipant = {
        ...otherParticipant.toObject(),
        isOnline: isUserOnline(otherParticipant._id)
      };
    }
    convObj.unreadCount = conversation.unreadCounts.get(req.user._id.toString()) || 0;

    res.json(convObj);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvee' });
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'firstName lastName email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: error.message });
  }
};

// Upload a file for chat
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const isImage = req.file.mimetype.startsWith('image/');

    res.json({
      url: req.file.path,
      publicId: req.file.filename,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      type: isImage ? 'image' : 'document'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a file from Cloudinary
exports.deleteFile = async (req, res) => {
  try {
    const { publicId } = req.params;

    await cloudinary.uploader.destroy(publicId);

    res.json({ message: 'Fichier supprime' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
};

// Search users to start a conversation
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
      .select('firstName lastName email profilePicture')
      .limit(10);

    // Add online status
    const usersWithStatus = users.map(user => ({
      ...user.toObject(),
      isOnline: isUserOnline(user._id)
    }));

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get total unread count for current user
exports.getUnreadCount = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    });

    const totalUnread = conversations.reduce((sum, conv) => {
      return sum + (conv.unreadCounts.get(req.user._id.toString()) || 0);
    }, 0);

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: error.message });
  }
};

// Mark conversation as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvee' });
    }

    // Mark all messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        [`readBy.${userId}`]: { $exists: false }
      },
      {
        $set: { [`readBy.${userId}`]: new Date() }
      }
    );

    // Reset unread count
    conversation.unreadCounts.set(userId, 0);
    await conversation.save();

    res.json({ message: 'Conversation marquee comme lue' });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: error.message });
  }
};
