const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../config/cloudinary');

// All routes require authentication
router.use(protect);

// Conversations
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/with/:userId', chatController.getOrCreateConversation);
router.patch('/conversations/:conversationId/read', chatController.markAsRead);

// File upload
router.post('/upload', upload.single('file'), chatController.uploadFile);
router.delete('/files/:publicId', chatController.deleteFile);

// Users search
router.get('/users/search', chatController.searchUsers);

// Unread count
router.get('/unread', chatController.getUnreadCount);

module.exports = router;
