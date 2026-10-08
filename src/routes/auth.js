const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { one, query } = require('../db/pool');
const { ah, requireLogin } = require('../lib/middleware');

// Very small in-memory throttle against password guessing
const attempts = new Map();
function tooMany(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(key, list);
  return list.length >= 8;
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/portal');
  res.render('auth/login', { title: 'Sign in', email: '' });
});

router.post('/login', ah(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const key = `${req.ip}|${email}`;
  if (tooMany(key)) {
    req.flash('error', 'Too many attempts. Please wait 15 minutes and try again.');
    return res.redirect('/login');
  }
  const user = await one('SELECT id, password_hash, is_active FROM users WHERE email = ?', [email]);
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    attempts.get(key).push(Date.now());
    return res.status(401).render('auth/login', { title: 'Sign in', email, flashes: [{ type: 'error', msg: 'Wrong email or password.' }] });
  }
  attempts.delete(key);
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = user.id;
    res.redirect('/portal');
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('trivia.sid'); res.redirect('/login'); });
});

// Account settings (shared by tutors and admins)
router.get('/account', requireLogin, (req, res) => {
  res.render('account', { title: 'Account Settings' });
});

router.post('/account/profile', requireLogin, ah(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const phone = String(req.body.phone || '').trim().slice(0, 40);
  const subjects = String(req.body.subjects || '').trim().slice(0, 255);
  if (!name) { req.flash('error', 'Name is required.'); return res.redirect('/account'); }
  await query('UPDATE users SET name = ?, phone = ?, subjects = ? WHERE id = ?', [name, phone || null, subjects || null, req.user.id]);
  req.flash('success', 'Profile updated.');
  res.redirect('/account');
}));

router.post('/account/password', requireLogin, ah(async (req, res) => {
  const { current, next: pw, confirm } = req.body;
  const row = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), row.password_hash))) {
    req.flash('error', 'Current password is incorrect.');
  } else if (String(pw || '').length < 8) {
    req.flash('error', 'New password must be at least 8 characters.');
  } else if (pw !== confirm) {
    req.flash('error', 'New passwords do not match.');
  } else {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 10), req.user.id]);
    req.flash('success', 'Password changed.');
  }
  res.redirect('/account');
}));

module.exports = router;
