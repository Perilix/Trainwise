function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  // Un compte du bureau (Hugo) n'a accès qu'au bureau de prospection.
  if (req.session && req.session.bureau) return res.redirect('/bureau');
  res.redirect('/login');
}

// Le bureau de prospection : les admins et les comptes du bureau.
function requireBureau(req, res, next) {
  if (req.session && req.session.bureau) return next();
  if (req.originalUrl.includes('/api/')) return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
  res.redirect('/login');
}

module.exports = { requireAuth, requireBureau };
