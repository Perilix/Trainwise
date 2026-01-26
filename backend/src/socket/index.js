const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');
const { createNotification } = require('../controllers/notification.controller');

let io;

// Store connected users: { odId: Set<socketId> }
const connectedUsers = new Map();

// Initialize Socket.io
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Token manquant'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Utilisateur non trouve'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Token invalide'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Add user to connected users
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    console.log(`User ${socket.user.firstName} connected (${socket.id})`);

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);

    // Join conversation rooms for this user
    joinUserConversations(socket);

    // Handle sending a message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text', attachment } = data;

        // Validate conversation exists and user is a participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id
        });

        if (!conversation) {
          return socket.emit('error', { message: 'Conversation non trouvee' });
        }

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: socket.user._id,
          content,
          type,
          attachment,
          readBy: new Map([[userId, new Date()]])
        });

        // Update conversation's last message
        conversation.lastMessage = {
          content: type === 'text' ? content : `[${type}]`,
          sender: socket.user._id,
          sentAt: new Date(),
          type
        };

        // Increment unread counts for other participants
        conversation.participants.forEach(participantId => {
          const pId = participantId.toString();
          if (pId !== userId) {
            const currentCount = conversation.unreadCounts.get(pId) || 0;
            conversation.unreadCounts.set(pId, currentCount + 1);
          }
        });

        await conversation.save();

        // Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'firstName lastName email');

        // Emit to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit('message:new', {
          message: populatedMessage,
          conversationId
        });

        // Emit conversation update to all participants
        const updatedConversation = await Conversation.findById(conversationId)
          .populate('participants', 'firstName lastName email');

        io.to(`conversation:${conversationId}`).emit('conversation:updated', {
          conversation: updatedConversation
        });

        // Créer des notifications pour les autres participants
        const messagePreview = type === 'text'
          ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
          : `[${type}]`;

        for (const participantId of conversation.participants) {
          const pId = participantId.toString();
          if (pId !== userId) {
            await createNotification({
              recipient: participantId,
              sender: socket.user._id,
              type: 'message',
              action: 'new_message',
              title: 'Nouveau message',
              message: `${socket.user.firstName} ${socket.user.lastName}: ${messagePreview}`,
              actionUrl: `/chat/${conversationId}`
            });
          }
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Handle typing start
    socket.on('typing:start', async (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.user._id,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      });
    });

    // Handle typing stop
    socket.on('typing:stop', async (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.user._id
      });
    });

    // Handle message read
    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;

        // Mark all messages as read
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.user._id },
            [`readBy.${userId}`]: { $exists: false }
          },
          {
            $set: { [`readBy.${userId}`]: new Date() }
          }
        );

        // Reset unread count for this user
        await Conversation.findByIdAndUpdate(conversationId, {
          $set: { [`unreadCounts.${userId}`]: 0 }
        });

        // Notify other participants
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          userId: socket.user._id
        });

      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle joining a conversation room
    socket.on('conversation:join', (data) => {
      const { conversationId } = data;
      socket.join(`conversation:${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on('conversation:leave', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.firstName} disconnected (${socket.id})`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });

  console.log('Socket.io initialized');
  return io;
};

// Join all conversation rooms for a user
const joinUserConversations = async (socket) => {
  try {
    const conversations = await Conversation.find({
      participants: socket.user._id
    });

    conversations.forEach(conversation => {
      socket.join(`conversation:${conversation._id}`);
    });
  } catch (error) {
    console.error('Error joining conversations:', error);
  }
};

// Get Socket.io instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io non initialise');
  }
  return io;
};

// Check if a user is online
const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

// Get online users
const getOnlineUsers = () => {
  return Array.from(connectedUsers.keys());
};

module.exports = {
  initializeSocket,
  getIO,
  isUserOnline,
  getOnlineUsers
};
