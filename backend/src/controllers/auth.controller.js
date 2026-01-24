const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { cloudinary } = require('../config/cloudinary');

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
        preferredTime: user.preferredTime
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
        preferredTime: user.preferredTime
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
      'preferredTime'
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
      const publicId = user.profilePicture.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(`runiq/avatars/${publicId.split('/').pop()}`);
    }

    // Update user with new avatar URL
    user.profilePicture = req.file.path;
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
      const publicId = user.profilePicture.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(`runiq/avatars/${publicId.split('/').pop()}`);
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
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
