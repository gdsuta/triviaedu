const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, one } = require('./pool');
const config = require('../config');

// Creates any missing tables and the first admin account.
// Runs automatically on server start, and can be run by hand: npm run migrate
async function ensureSchema({ log = console.log } = {}) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  for (const stmt of statements) await pool.query(stmt);

  const admin = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const { name, email, password } = config.admin;
    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        [name, email.toLowerCase(), hash]
      );
      log(`[migrate] Created admin account ${email}`);
    } else {
      log('[migrate] No admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart.');
    }
  }
}

module.exports = { ensureSchema };

if (require.main === module) {
  ensureSchema()
    .then(() => { console.log('[migrate] Done'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
