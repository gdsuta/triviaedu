# CLAUDE.md

This file gives Claude Code context for working in this repository.

## What this is

**triviaedu.com**, the website of Trivia Education (Trivia Edutech Indonesia), a private tutoring business in Indonesia for IB, Cambridge and national curriculum students. One Node.js app serves two parts:

1. **Public website** (`/`, `/ib-tuition`, `/fees` …). Marketing pages migrated from the old WordPress site (https://triviaedu.wordpress.com/). English pages, plus Indonesian (`lang="id"`) pages for the local programs (SNBT, Kedinasan, TOEFL/IELTS, Mahasiswa).
2. **Tutor & admin portal** (`/login`, `/portal`, `/tutor/*`, `/admin/*`, `/account`). Tutors log availability, timesheets and progress reports. Admins review timesheets, manage tutors and students, and export the hours recap CSV.

## Stack

- Node.js ≥ 18 (deploy on 20 or 22), Express 4, EJS templates, no build step and no frontend framework
- MariaDB/MySQL through `mysql2` (pool in `src/db/pool.js`); sessions stored in the DB (`express-mysql-session`)
- `helmet` CSP: scripts, styles and images from `'self'` only (plus Google Fonts and `data:` images). **No inline `<script>` or `style=""` attributes.** Put CSS in `public/css/` and JS in `public/js/`.
- Plain CSS with design tokens on `:root` in `public/css/app.css`, with light and dark themes. `public/css/site.css` (public site) builds on those tokens.

## Commands

```bash
npm install
npm run dev       # node --watch server.js → http://localhost:3000
npm start         # production
npm run migrate   # create tables + first admin (also runs automatically on start)
```

No test suite or linter yet. To check changes, run the server and `curl` the pages. Public pages render without a database. The portal needs MariaDB and a `.env` file (copy `.env.example`).

## Layout

```
server.js                 middleware order: helmet → static → PUBLIC SITE → session → user → flash/csrf → portal routes
src/config.js             env vars
src/content/contact.js    phone / WhatsApp / email / address used by every public page; edit contact details here
src/routes/site.js        public pages registry (path, view, title, meta description, menu group, lang) + robots.txt + sitemap.xml
src/routes/auth.js        login/logout/account
src/routes/tutor.js       tutor portal
src/routes/admin.js       admin portal
src/db/schema.sql         tables; add new `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` here (runs on every start)
views/site/               public pages; partials/head.ejs, foot.ejs, cta.ejs
views/partials/           portal layout (sidebar shell)
views/{tutor,admin,auth}/ portal pages
public/img/site/          photos used by the public site
.claude/skills/           project-specific Claude Code skills (see its README)
```

## Conventions and gotchas

- **The public site is mounted before the session middleware** on purpose, so anonymous visitors and crawlers don't create session rows in MariaDB. Public pages therefore have no `req.session`, `user` or `csrf`. Keep them stateless. Anything that needs a login goes under the portal.
- **Adding a public page:** add an entry to `pages` in `src/routes/site.js` (it updates the menu, footer and sitemap automatically) and create `views/site/<view>.ejs` that starts with `include('partials/head')` and ends with `include('partials/cta')` and `include('partials/foot')`. Don't name a page property `nav`, because that name is taken by the header menu local.
- The page's `group` field (`'programs'` or `'main'`) places it in the header and footer menus. Omit it to keep a page out of the menus.
- `/` is the public home page. `/portal` redirects logged-in users to `/tutor` or `/admin`, or sends them to `/login`.
- Static files are cached for 7 days in production. **Bump the `?v=` query** on CSS/JS links in `views/partials/*.ejs` and `views/site/partials/*.ejs` when you change those files.
- Currency is IDR and the timezone is Asia/Makassar (`APP_TIMEZONE`).
- Old WordPress posts that copied third-party articles (Telegraph, Times Higher Education, Education Post) were **not** migrated. `/ib-or-a-level` is an original summary that links to the sources. Don't paste copyrighted articles into the site.
- Old WordPress images with a "tutorprivat.com" watermark were left out.

## Hosting: Hostinger

- Domain and hosting are on Hostinger. **Node.js apps need the Business Web Hosting plan (or Cloud).** Single Web Hosting can't run this app. The owner chose to upgrade to Business (2026-10-09).
- Deploy with hPanel → Websites → Node.js web app, connected to the GitHub repo (or a zip upload without `node_modules`). Entry file `server.js`, start command `npm start`, Node 20/22. Hostinger sets `PORT`; don't set it yourself.
- Set env vars in hPanel (see `.env.example`). `DB_HOST` is usually `localhost`. Hostinger adds a `u123456789_` prefix to database and user names.
- `app.set('trust proxy', 1)` is required because Hostinger runs Node behind a proxy (secure cookies depend on it).

## Open content questions (confirm with the owner)

- Office address: the WordPress "Location" page says Jl. HR Rasuna Said Kav. C5, Jakarta Selatan, and the older "Company Profile" says Indragiri 390, Depok. The site uses the Jakarta address.
- Email: the site uses contact@triviaedu.com. The old profile listed contact@tutorprivat.com.
- Tuition fee "from IDR 200,000 per online session (primary)" comes from a 2022 post. Check that it is still current.
