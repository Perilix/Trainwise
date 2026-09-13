const mongoose = require('mongoose');

const betaFeedbackSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['bug', 'ui', 'perf', 'idea'],
    required: true
  },
  screen: {
    type: String,
    enum: ['home', 'chat', 'planning', 'sorties', 'profil', 'boutique', 'auth', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'med', 'high', 'crit'],
    required: true
  },
  status: {
    type: String,
    enum: ['triage', 'open', 'prog', 'planned', 'fixed', 'closed'],
    default: 'triage',
    index: true
  },
  title: {
    type: String,
    default: null
  },
  votes: {
    type: Number,
    default: 0
  },
  voters: [{
    type: String
  }],
  publicOnCommunity: {
    type: Boolean,
    default: false
  },
  contactMe: {
    type: Boolean,
    default: true
  },
  screenshotUrl: {
    type: String,
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    default: null
  },
  meta: {
    userAgent: String,
    appVersion: String,
    locale: String,
    timezone: String,
    ip: String
  }
}, {
  timestamps: true
});

betaFeedbackSchema.index({ createdAt: -1 });
betaFeedbackSchema.index({ publicOnCommunity: 1, status: 1, votes: -1 });

module.exports = mongoose.model('BetaFeedback', betaFeedbackSchema);
