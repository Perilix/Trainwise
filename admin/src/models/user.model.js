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
  weeklyFrequency: { type: Number, default: null },
  age: { type: Number, default: null },
  gender: { type: String, default: null },
  bio: { type: String, default: '' },
  vma: { type: Number, default: null },
  fcmax: { type: Number, default: null },
  hasCompletedOnboarding: { type: Boolean, default: false },
  toursSeen: { type: [String], default: [] },
  trainCoins: { type: Number, default: 10, min: 0 },
  subscriptionStatus: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscriptionExpiry: { type: Date, default: null },
  revenueCatUserId: { type: String, default: null },
  // Abonnement coach (Stripe). Écrit par le webhook côté API, ou posé à la main
  // depuis ce back-office pour offrir un plan.
  coachBilling: {
    customerId: { type: String, default: null },
    subscriptionId: { type: String, default: null },
    planId: { type: String, default: 'decouverte' },
    cycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    status: { type: String, enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete'], default: 'active' },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  // Seuils d'alerte du coach (plan Studio).
  coachAlertRules: {
    inactivityOrange: { type: Number, default: 7 },
    inactivityRed: { type: Number, default: 14 },
    skippedOrange: { type: Number, default: 1 },
    skippedRed: { type: Number, default: 3 },
    feelingOrange: { type: Number, default: 7 },
    feelingRed: { type: Number, default: 4 },
    volumeDropEnabled: { type: Boolean, default: true },
    volumeDropPercent: { type: Number, default: 50 }
  },
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
