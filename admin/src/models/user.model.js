const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: { type: String, trim: true },
  profilePicture: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin', 'coach'], default: 'user' },
  coachInviteCode: { type: String, unique: true, sparse: true },
  runningLevel: { type: String, default: null },
  goal: { type: String, default: null },
  weeklyFrequency: { type: Number, default: null },
  age: { type: Number, default: null },
  gender: { type: String, default: null },
  bio: { type: String, default: '' },
  vma: { type: Number, default: null },
  fcmax: { type: Number, default: null },
  hasCompletedOnboarding: { type: Boolean, default: false },
  trainCoins: { type: Number, default: 10, min: 0 },
  subscriptionStatus: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionExpiry: { type: Date, default: null },
  revenueCatUserId: { type: String, default: null },
  strava: {
    athleteId: { type: Number, default: null }
  },
  pushToken: { type: String, default: null },
  pushPlatform: { type: String, enum: ['ios', 'android', 'web'], default: null },
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
