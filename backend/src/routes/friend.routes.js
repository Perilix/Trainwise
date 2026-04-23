const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friend.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/friends/search:
 *   get:
 *     summary: Search users by name or email
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: List of matching users
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/search', friendController.searchUsers);

/**
 * @swagger
 * /api/friends:
 *   get:
 *     summary: Get the current user's friends list
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friends
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/', friendController.getFriends);

/**
 * @swagger
 * /api/friends/requests/pending:
 *   get:
 *     summary: Get pending friend requests received
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/requests/pending', friendController.getPendingRequests);

/**
 * @swagger
 * /api/friends/requests/sent:
 *   get:
 *     summary: Get pending friend requests sent by the current user
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sent requests
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/requests/sent', friendController.getSentRequests);

/**
 * @swagger
 * /api/friends/status/{userId}:
 *   get:
 *     summary: Get friendship status with a specific user
 *     tags: [Friends]
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
 *         description: Friendship status (none, pending, friends)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [none, pending_sent, pending_received, friends]
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/status/:userId', friendController.getFriendshipStatus);

/**
 * @swagger
 * /api/friends/profile/{userId}:
 *   get:
 *     summary: Get a friend's public profile
 *     tags: [Friends]
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
 *         description: Friend's profile data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not friends with this user
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/profile/:userId', friendController.getFriendProfile);

/**
 * @swagger
 * /api/friends/request/{userId}:
 *   post:
 *     summary: Send a friend request to a user
 *     tags: [Friends]
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
 *         description: Friend request sent
 *       400:
 *         description: Already friends or request already sent
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Cancel a pending friend request
 *     tags: [Friends]
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
 *         description: Friend request cancelled
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.post('/request/:userId', friendController.sendFriendRequest);
router.delete('/request/:userId', friendController.cancelFriendRequest);

/**
 * @swagger
 * /api/friends/request/{friendshipId}/respond:
 *   patch:
 *     summary: Accept or reject a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendshipId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accept]
 *             properties:
 *               accept:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Request accepted or rejected
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Request not found
 *       500:
 *         description: Server error
 */
router.patch('/request/:friendshipId/respond', friendController.respondToFriendRequest);

/**
 * @swagger
 * /api/friends/{userId}:
 *   delete:
 *     summary: Remove a friend
 *     tags: [Friends]
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
 *         description: Friend removed
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Friendship not found
 *       500:
 *         description: Server error
 */
router.delete('/:userId', friendController.removeFriend);

module.exports = router;
