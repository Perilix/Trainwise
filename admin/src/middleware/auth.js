function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.redirect('/login');
}

module.exports = { requireAuth };
