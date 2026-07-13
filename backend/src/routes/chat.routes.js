const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../config/cloudinary');

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: Get all conversations for the current user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations with last message preview
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/conversations', chatController.getConversations);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Message ID for pagination (load older messages)
 *     responses:
 *       200:
 *         description: List of messages
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a participant of this conversation
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Server error
 */
router.get('/conversations/:conversationId/messages', chatController.getMessages);

/**
 * @swagger
 * /api/chat/conversations/with/{userId}:
 *   post:
 *     summary: Get or create a direct conversation with a user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Existing or newly created conversation
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/conversations/with/:userId', chatController.getOrCreateConversation);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/read:
 *   patch:
 *     summary: Mark all messages in a conversation as read
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Server error
 */
router.patch('/conversations/:conversationId/read', chatController.markAsRead);

/**
 * @swagger
 * /api/chat/upload:
 *   post:
 *     summary: Upload a file to attach in a chat message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded, returns URL and publicId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                 publicId:
 *                   type: string
 *       400:
 *         description: No file provided
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/upload', upload.single('file'), chatController.uploadFile);

/**
 * @swagger
 * /api/chat/files/{publicId}:
 *   delete:
 *     summary: Delete an uploaded file from Cloudinary
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Cloudinary public ID of the file (URL-encoded)
 *     responses:
 *       200:
 *         description: File deleted
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/files/:publicId', chatController.deleteFile);

/**
 * @swagger
 * /api/chat/users/search:
 *   get:
 *     summary: Search users to start a conversation with
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (name or email)
 *     responses:
 *       200:
 *         description: List of matching users
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/users/search', chatController.searchUsers);

/**
 * @swagger
 * /api/chat/unread:
 *   get:
 *     summary: Get total unread messages count across all conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/unread', chatController.getUnreadCount);

/**
 * @swagger
 * /api/chat/partner-coach:
 *   get:
 *     summary: Get the partner coach profile for the discover page
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner coach profile
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No partner coach found
 *       500:
 *         description: Server error
 */
router.get('/partner-coach', chatController.getPartnerCoach);

/**
 * @swagger
 * /api/chat/partner-coach/subscription-request:
 *   post:
 *     summary: Send a coaching subscription request to the partner coach
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request sent, coach notified
 *       400:
 *         description: Invalid package type
 */
router.post('/partner-coach/subscription-request', chatController.requestCoachSubscription);

module.exports = router;
