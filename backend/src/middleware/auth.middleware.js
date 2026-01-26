const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Non autorisé - Token manquant' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Non autorisé - Token invalide' });
  }
};

// Admin only middleware
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

// Coach only middleware
exports.coachOnly = (req, res, next) => {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ error: 'Accès réservé aux coachs' });
  }
  next();
};
