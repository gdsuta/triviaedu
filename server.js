const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');

const config = require('./src/config');
const { pool, one } = require('./src/db/pool');
const { ensureSchema } = require('./src/db/migrate');
const { flash, csrf } = require('./src/lib/middleware');
const dates = require('./src/lib/dates');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Hostinger runs Node behind a proxy

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
    },
  },
}));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProd ? '7d' : 0 }));

// Public website: mounted before sessions so visitors and crawlers never create session rows
app.use(require('./src/routes/site'));

app.use(session({
  name: 'trivia.sid',
  secret: config.sessionSecret,
  store: new MySQLStore({ createDatabaseTable: true, clearExpired: true }, pool),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

// Load the logged-in user on every request
app.use(async (req, res, next) => {
  try {
    if (req.session.userId) {
      req.user = await one('SELECT id, name, email, role, phone, subjects, hourly_rate, is_active FROM users WHERE id = ?', [req.session.userId]);
      if (!req.user || !req.user.is_active) { req.user = null; delete req.session.userId; }
    }
    res.locals.user = req.user || null;
    res.locals.app = { name: config.appName, currency: config.currency };
    res.locals.d = dates;
    res.locals.path = req.path;
    next();
  } catch (e) { next(e); }
});
app.use(flash);
app.use(csrf);

app.use('/', require('./src/routes/auth'));
app.use('/tutor', require('./src/routes/tutor'));
app.use('/admin', require('./src/routes/admin'));

app.get('/portal', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.redirect(req.user.role === 'admin' ? '/admin' : '/tutor');
});

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', message: 'That page does not exist.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: config.isProd ? 'Please try again in a moment.' : err.message });
});

ensureSchema()
  .catch((e) => console.error('[startup] Database not ready:', e.message))
  .finally(() => app.listen(config.port, () => console.log(`${config.appName} running on port ${config.port}`)));
