const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../config/cloudinary');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [athlete, coach]
 *     responses:
 *       201:
 *         description: User created successfully, JWT token returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Validation error or email already in use
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
router.post('/register', authLimiter, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, JWT token returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
router.post('/login', authLimiter, authController.login);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent if the address exists
 *       400:
 *         description: Missing email
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
router.post('/forgot-password', authLimiter, authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using a token received by email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token from the email link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid or expired token
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Server error
 */
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 role:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 trainCoins:
 *                   type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/me', protect, authController.getMe);

/**
 * @swagger
 * /api/auth/tours:
 *   post:
 *     summary: Mark a feature tour as seen for the authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pageId]
 *             properties:
 *               pageId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated list of seen tours
 *       400:
 *         description: Missing pageId
 *       401:
 *         description: Not authenticated
 *   delete:
 *     summary: Reset all seen feature tours (replay them)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tours reset
 *       401:
 *         description: Not authenticated
 */
router.post('/tours', protect, authController.markTourSeen);
router.delete('/tours', protect, authController.resetToursSeen);

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               vma:
 *                 type: number
 *                 description: Maximum aerobic speed (km/h)
 *               weight:
 *                 type: number
 *               birthDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.patch('/profile', protect, authController.updateProfile);

/**
 * @swagger
 * /api/auth/avatar:
 *   post:
 *     summary: Upload a profile avatar image
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (jpg, png, webp)
 *     responses:
 *       200:
 *         description: Avatar uploaded and URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 avatar:
 *                   type: string
 *                   format: uri
 *       400:
 *         description: No file provided
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post('/avatar', protect, uploadAvatar.single('avatar'), authController.uploadAvatar);

/**
 * @swagger
 * /api/auth/avatar:
 *   delete:
 *     summary: Delete the authenticated user's avatar
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/avatar', protect, authController.deleteAvatar);

/**
 * @swagger
 * /api/auth/account:
 *   delete:
 *     summary: Permanently delete the authenticated user's account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.delete('/account', protect, authController.deleteAccount);

module.exports = router;
