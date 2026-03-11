const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../config/cloudinary');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, authController.updateProfile);
router.post('/avatar', protect, uploadAvatar.single('avatar'), authController.uploadAvatar);
router.delete('/avatar', protect, authController.deleteAvatar);

module.exports = router;
