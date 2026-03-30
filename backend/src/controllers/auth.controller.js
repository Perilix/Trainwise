const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { cloudinary } = require('../config/cloudinary');
const emailService = require('../services/email.service');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Create user
    const user = await User.create({ email, password, firstName, lastName, phone });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profilePicture: user.profilePicture,
        role: user.role,
        runningLevel: user.runningLevel,
        goal: user.goal,
        goalDetails: user.goalDetails,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries,
        availableDays: user.availableDays,
        preferredTime: user.preferredTime,
        age: user.age,
        gender: user.gender,
        disciplines: user.disciplines,
        experience: user.experience,
        diplomas: user.diplomas,
        bio: user.bio,
        vma: user.vma,
        fcmax: user.fcmax,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        trainCoins: user.trainCoins,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profilePicture: user.profilePicture,
        role: user.role,
        runningLevel: user.runningLevel,
        goal: user.goal,
        goalDetails: user.goalDetails,
        weeklyFrequency: user.weeklyFrequency,
        injuries: user.injuries,
        availableDays: user.availableDays,
        preferredTime: user.preferredTime,
        age: user.age,
        gender: user.gender,
        disciplines: user.disciplines,
        experience: user.experience,
        diplomas: user.diplomas,
        bio: user.bio,
        vma: user.vma,
        fcmax: user.fcmax,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        trainCoins: user.trainCoins,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      runningLevel: user.runningLevel,
      goal: user.goal,
      goalDetails: user.goalDetails,
      weeklyFrequency: user.weeklyFrequency,
      injuries: user.injuries,
      availableDays: user.availableDays,
      preferredTime: user.preferredTime,
      age: user.age,
      gender: user.gender,
      disciplines: user.disciplines,
      experience: user.experience,
      diplomas: user.diplomas,
      bio: user.bio,
      strengthFrequency: user.strengthFrequency,
      strengthGoal: user.strengthGoal,
      strengthType: user.strengthType,
      vma: user.vma,
      fcmax: user.fcmax,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      trainCoins: user.trainCoins,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'runningLevel',
      'goal',
      'goalDetails',
      'weeklyFrequency',
      'injuries',
      'availableDays',
      'preferredTime',
      'age',
      'gender',
      'disciplines',
      'experience',
      'diplomas',
      'bio',
      'strengthFrequency',
      'strengthGoal',
      'strengthType',
      'vma',
      'fcmax',
      'hasCompletedOnboarding'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      runningLevel: user.runningLevel,
      goal: user.goal,
      goalDetails: user.goalDetails,
      weeklyFrequency: user.weeklyFrequency,
      injuries: user.injuries,
      availableDays: user.availableDays,
      preferredTime: user.preferredTime,
      age: user.age,
      gender: user.gender,
      disciplines: user.disciplines,
      experience: user.experience,
      diplomas: user.diplomas,
      bio: user.bio,
      strengthFrequency: user.strengthFrequency,
      strengthGoal: user.strengthGoal,
      strengthType: user.strengthType,
      vma: user.vma,
      fcmax: user.fcmax,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      trainCoins: user.trainCoins,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Upload profile picture
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }

    const user = await User.findById(req.user.id);

    // Delete old avatar from Cloudinary if exists
    if (user.profilePicture) {
      // Extract public_id from URL
      const urlParts = user.profilePicture.split('/');
      const publicIdWithExt = urlParts.slice(-2).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.log('Could not delete old avatar:', e.message);
      }
    }

    // Upload new avatar to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'runiq/avatars',
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Update user with new avatar URL
    user.profilePicture = uploadResult.secure_url;
    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      runningLevel: user.runningLevel,
      goal: user.goal,
      goalDetails: user.goalDetails,
      weeklyFrequency: user.weeklyFrequency,
      injuries: user.injuries,
      availableDays: user.availableDays,
      preferredTime: user.preferredTime,
      age: user.age,
      gender: user.gender,
      disciplines: user.disciplines,
      experience: user.experience,
      diplomas: user.diplomas,
      bio: user.bio,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete profile picture
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.profilePicture) {
      // Extract public_id from URL (format: runiq/avatars/filename)
      const urlParts = user.profilePicture.split('/');
      const publicIdWithExt = urlParts.slice(-2).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.log('Could not delete avatar:', e.message);
      }
    }

    user.profilePicture = null;
    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePicture: user.profilePicture,
      role: user.role,
      runningLevel: user.runningLevel,
      goal: user.goal,
      goalDetails: user.goalDetails,
      weeklyFrequency: user.weeklyFrequency,
      injuries: user.injuries,
      availableDays: user.availableDays,
      preferredTime: user.preferredTime,
      age: user.age,
      gender: user.gender,
      disciplines: user.disciplines,
      experience: user.experience,
      diplomas: user.diplomas,
      bio: user.bio,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'Si cet email est enregistré, vous recevrez un lien de réinitialisation.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'email. Veuillez réessayer." });
    }

    res.status(200).json({ message: 'Si cet email est enregistré, vous recevrez un lien de réinitialisation.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré.' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
