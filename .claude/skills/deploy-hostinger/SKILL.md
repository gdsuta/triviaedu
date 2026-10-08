---
name: deploy-hostinger
description: Deploy or update triviaedu.com on Hostinger (Business Web Hosting, Node.js web app + MariaDB). Use when the user asks how to deploy, publish, go live, set environment variables, connect the domain, or troubleshoot the site on Hostinger/hPanel.
---

# Deploying to Hostinger

**Plan requirement:** Node.js web apps run on Hostinger **Business** Web Hosting or Cloud plans. **Single** Web Hosting supports only PHP and static files, so this app can't run there. If the user is still on Single, tell them first.

## First deployment

1. **Database:** hPanel → Databases → Management: create a MariaDB database and user. Note the full names (prefixed `u123456789_`) and the password.
2. **Code:** push to the GitHub repo (`main`). Never commit `.env` or `node_modules`.
3. **Node.js app:** hPanel → Websites → Add website → Node.js web app (or the site's Node.js section). Connect GitHub (or upload a zip without `node_modules`).
   - Framework preset: Express (or Other)
   - Node version: 20 or 22
   - Install: `npm install`, start: `npm start`, entry file: `server.js`
4. **Environment variables** (from `.env.example`): `NODE_ENV=production`, `APP_URL=https://triviaedu.com`, a long random `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), `DB_HOST=localhost`, `DB_PORT=3306`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. **Do not set `PORT`.**
5. **Domain:** attach triviaedu.com to the Node.js app (the domain is registered at Hostinger, so DNS is managed in hPanel). Turn on SSL (free Let's Encrypt) and force HTTPS. Secure cookies need HTTPS in production.
6. Deploy, open https://triviaedu.com, sign in at `/login` with the admin account, change the admin password, then remove `ADMIN_PASSWORD` from the env vars.

## Updates

Push to `main` and redeploy from hPanel (or turn on auto-deploy). Schema changes go in `src/db/schema.sql` as idempotent statements, and they run on startup.

## Pre-deploy checklist

- [ ] `npm install && NODE_ENV=production PORT=3123 node server.js` starts, and the public pages return 200
- [ ] `?v=` bumped on any changed CSS/JS
- [ ] No secrets in the repo (`git grep -i password` only shows `.env.example` placeholders)
- [ ] `APP_URL` is correct (used in canonical links, `robots.txt` and `sitemap.xml`)

## After launch

- Submit `https://triviaedu.com/sitemap.xml` in Google Search Console.
- Update the old WordPress site's home page so it points to triviaedu.com (it already says "Check our new website").

## Troubleshooting

- **503 or app not starting:** check the Node.js app logs in hPanel, and check that the Node version is ≥ 18.
- **"Database not ready" in logs:** wrong `DB_*` values or missing prefix. Public pages still work, but login doesn't.
- **Logged out right after login:** HTTPS isn't on, or `NODE_ENV` isn't `production`, or the proxy setting changed (`trust proxy` must stay at 1).
- Hostinger renames hPanel menus from time to time. Look for the Node.js app's build settings and environment variables sections.
