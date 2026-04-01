const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  password: {
    type: String,
    required: [true, 'Mot de passe requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'Prénom requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Nom requis'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'coach'],
    default: 'user'
  },
  // Code d'invitation pour les coachs
  coachInviteCode: {
    type: String,
    unique: true,
    sparse: true
    // pas de default: null — le champ doit être absent (undefined) pour que l'index sparse l'ignore
  },
  // Profil coureur
  runningLevel: {
    type: String,
    enum: ['debutant', 'intermediaire', 'confirme', 'expert'],
    default: null
  },
  goal: {
    type: String,
    enum: ['remise_en_forme', '5km', '10km', 'semi_marathon', 'marathon', 'trail', 'ultra', 'autre'],
    default: null
  },
  goalDetails: {
    type: String,
    trim: true
  },
  weeklyFrequency: {
    type: Number,
    min: 1,
    max: 14,
    default: null
  },
  injuries: {
    type: String,
    trim: true
  },
  // Disponibilités d'entraînement
  availableDays: {
    type: [String],
    enum: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    default: []
  },
  preferredTime: {
    type: String,
    enum: ['matin', 'midi', 'soir', 'flexible'],
    default: 'flexible'
  },
  age: {
    type: Number,
    min: 1,
    max: 120,
    default: null
  },
  gender: {
    type: String,
    enum: ['homme', 'femme', 'autre'],
    default: null
  },
  // Profil coach
  disciplines: {
    type: [String],
    default: []
  },
  experience: {
    type: Number,
    default: null
  },
  diplomas: {
    type: [String],
    default: []
  },
  bio: {
    type: String,
    trim: true,
    default: ''
  },
  // Données physiques running
  vma: {
    type: Number,
    min: 8,
    max: 30,
    default: null
  },
  fcmax: {
    type: Number,
    min: 100,
    max: 220,
    default: null
  },
  // Onboarding
  hasCompletedOnboarding: {
    type: Boolean,
    default: false
  },
  // TrainCoins & abonnement
  trainCoins: {
    type: Number,
    default: 10,
    min: 0
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  subscriptionExpiry: {
    type: Date,
    default: null
  },
  revenueCatUserId: {
    type: String,
    default: null
  },
  // Profil muscu
  strengthFrequency: {
    type: Number,
    min: 0,
    max: 14,
    default: null
  },
  strengthGoal: {
    type: String,
    enum: ['force', 'hypertrophie', 'endurance_musculaire', 'remise_en_forme', 'fonctionnel'],
    default: null
  },
  strengthType: {
    type: String,
    enum: ['poids_libres', 'machines', 'bodyweight', 'crossfit', 'mixte'],
    default: null
  },
  // Intégration Strava
  strava: {
    athleteId: {
      type: Number,
      default: null
    },
    accessToken: {
      type: String,
      select: false
    },
    refreshToken: {
      type: String,
      select: false
    },
    expiresAt: {
      type: Number,
      default: null
    },
    connectedAt: {
      type: Date,
      default: null
    }
  },
  // Push notifications
  pushToken: {
    type: String,
    default: null
  },
  pushPlatform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    default: null
  },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
