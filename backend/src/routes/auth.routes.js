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

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, authController.updateProfile);
router.post('/avatar', protect, uploadAvatar.single('avatar'), authController.uploadAvatar);
router.delete('/avatar', protect, authController.deleteAvatar);
router.delete('/account', protect, authController.deleteAccount);

module.exports = router;
