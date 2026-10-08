const crypto = require('crypto');

// --- Flash messages (one-shot notices shown after a redirect) ---
function flash(req, res, next) {
  req.flash = (type, msg) => { (req.session.flash ||= []).push({ type, msg }); };
  res.locals.flashes = req.session.flash || [];
  delete req.session.flash;
  next();
}

// --- CSRF: per-session token checked on every POST ---
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST') {
    const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
    if (!sent || sent !== req.session.csrf) {
      return res.status(403).render('error', { title: 'Session expired', message: 'Your session expired. Please go back, refresh and try again.' });
    }
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== role) return res.status(403).render('error', { title: 'Not allowed', message: 'You do not have access to this page.' });
  next();
};

// Wrap async route handlers so errors reach the error handler
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { flash, csrf, requireLogin, requireRole, ah };
