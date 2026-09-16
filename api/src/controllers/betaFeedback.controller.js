const crypto = require('crypto');
const BetaFeedback = require('../models/betaFeedback.model');

const TICKET_MIN = 248;
const TICKET_MAX = 9999;

const generateTicketId = async () => {
  for (let i = 0; i < 5; i++) {
    const n = TICKET_MIN + Math.floor(Math.random() * (TICKET_MAX - TICKET_MIN));
    const ticketId = `#TW-${String(n).padStart(4, '0')}`;
    const exists = await BetaFeedback.exists({ ticketId });
    if (!exists) return ticketId;
  }
  const fallback = await BetaFeedback.countDocuments();
  return `#TW-${String(fallback + TICKET_MIN).padStart(4, '0')}`;
};

const hashVoter = (req) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
};

exports.createFeedback = async (req, res) => {
  try {
    const { type, screen, description, severity, contactMe, title } = req.body;

    if (!type || !screen || !description || !severity) {
      return res.status(400).json({ error: 'Champs manquants : type, screen, description et severity sont requis.' });
    }
    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'La description doit faire au moins 10 caractères.' });
    }

    const ticketId = await generateTicketId();

    const feedback = await BetaFeedback.create({
      ticketId,
      type,
      screen,
      description: description.trim().slice(0, 1000),
      severity,
      title: title || null,
      contactMe: contactMe !== false,
      user: req.user?._id || null,
      email: req.user?.email || req.body.email || null,
      meta: {
        userAgent: req.headers['user-agent'] || null,
        appVersion: req.body.appVersion || null,
        locale: req.body.locale || req.headers['accept-language']?.split(',')[0] || null,
        timezone: req.body.timezone || null,
        ip: req.ip || null
      }
    });

    res.status(201).json({
      ticketId: feedback.ticketId,
      status: feedback.status,
      createdAt: feedback.createdAt
    });
  } catch (error) {
    console.error('Erreur création feedback bêta:', error);
    res.status(500).json({ error: 'Erreur lors de la création du retour.' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [total, fixed] = await Promise.all([
      BetaFeedback.countDocuments(),
      BetaFeedback.countDocuments({ status: 'fixed' })
    ]);

    const User = require('../models/user.model');
    const testers = await User.countDocuments();

    res.json({
      testers,
      feedbacks: total,
      fixed,
      avgResponseHours: 72
    });
  } catch (error) {
    console.error('Erreur stats bêta:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des stats.' });
  }
};

exports.getCommunity = async (req, res) => {
  try {
    const items = await BetaFeedback.find({})
      .sort({ votes: -1, createdAt: -1 })
      .limit(5)
      .select('ticketId title description screen status votes createdAt');

    const snippet = (desc) => {
      if (!desc) return 'Retour bêta';
      const clean = desc.trim().replace(/\s+/g, ' ');
      return clean.length > 80 ? clean.slice(0, 77) + '…' : clean;
    };

    res.json({
      items: items.map(i => ({
        id: i._id,
        ticketId: i.ticketId,
        title: i.title || snippet(i.description),
        screen: i.screen,
        status: i.status,
        votes: i.votes
      }))
    });
  } catch (error) {
    console.error('Erreur community bêta:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la communauté.' });
  }
};

exports.getMyCount = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [countMonth, countTotal] = await Promise.all([
      BetaFeedback.countDocuments({ user: req.user._id, createdAt: { $gte: startOfMonth } }),
      BetaFeedback.countDocuments({ user: req.user._id })
    ]);

    res.json({
      countMonth,
      countTotal,
      goal: 5
    });
  } catch (error) {
    console.error('Erreur my-count bêta:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du compteur.' });
  }
};

exports.toggleVote = async (req, res) => {
  try {
    const { id } = req.params;
    const voter = hashVoter(req);

    const feedback = await BetaFeedback.findById(id);
    if (!feedback || !feedback.publicOnCommunity) {
      return res.status(404).json({ error: 'Retour introuvable.' });
    }

    const idx = feedback.voters.indexOf(voter);
    if (idx >= 0) {
      feedback.voters.splice(idx, 1);
      feedback.votes = Math.max(0, feedback.votes - 1);
    } else {
      feedback.voters.push(voter);
      feedback.votes += 1;
    }
    await feedback.save();

    res.json({ votes: feedback.votes, voted: idx < 0 });
  } catch (error) {
    console.error('Erreur vote bêta:', error);
    res.status(500).json({ error: 'Erreur lors du vote.' });
  }
};
