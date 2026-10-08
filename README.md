# Trivia Education: Website, Tutor & Admin Portal

**triviaedu.com**: the public website (content migrated from triviaedu.wordpress.com) and the tutor and admin portal, in one Node.js (Express + EJS) app with MariaDB.

## Public website

Home, IB Tuition, Cambridge Tuition, Les SNBT & Ujian Mandiri, Les Sekolah Kedinasan, Les TOEFL & IELTS, Les Privat Mahasiswa, IB or A Level? guide, Students, Tutors, Fees, Locations and About, plus `robots.txt` and `sitemap.xml`. Pages are listed in `src/routes/site.js`, and contact details live in `src/content/contact.js`. The public pages don't use sessions or the database. The portal is at `/login`.

## Features

**Tutors**
- **Dashboard**: a monthly calendar of their logged sessions, with a summary of activities, hours, pending reviews and students
- **Available Time**: a weekly grid of 30-minute slots (08:00–22:00). Tutors click or drag to fill it in, and clicking a day header ticks the whole day
- **Tutoring Timesheet**: tutors log the sessions they taught (student, subject, date, time, online or in person, topic). The app blocks overlapping sessions and dates in the future. Tutors can edit or delete a session until it is approved
- **Progress Report**: one report per student and subject each month, with a 1–5 rating, topics covered, strengths, areas to improve and next steps. Tutors can save a draft and submit later
- **Account Settings**: edit their profile and change their password

**Admins**
- **Overview**: pending reviews, approved hours, active tutors and students, and reports submitted
- **Timesheet Review**: filter by month, status or tutor, then approve or reject sessions in bulk with an optional note
- **Tutors**: add or edit tutors, set hourly rates, deactivate tutors, reset passwords (temporary passwords are generated), and view each tutor's availability
- **Students**: add or edit students and parent details, and assign tutors per subject
- **Progress Reports**: read any report, print it or save it as a PDF, and send it back to the tutor for edits
- **Hours Recap**: approved and pending hours per tutor with the amount owed, plus a **CSV download** for payroll

Other details: light and dark mode, works on phones, sessions are stored in MariaDB, every form is protected against CSRF, logins are rate-limited and passwords are hashed with bcrypt.

## Run locally

```bash
npm install
cp .env.example .env      # fill in DB_* and ADMIN_* (set NODE_ENV=development locally)
npm run dev               # http://localhost:3000
```

Create an empty database first. The app creates all of its tables and the first admin account automatically when it starts. You can also run `npm run migrate`.

## Deploy to Hostinger (Node.js + MariaDB)

> **Plan:** Node.js apps need Hostinger **Business** Web Hosting (or Cloud). **Single** Web Hosting can't run this app.

1. **Create the database.** In hPanel → **Databases**, create a MariaDB database and a user. Write down the database name, user and password. Hostinger adds a prefix such as `u123456789_` to both names.
2. **Push this code to GitHub** (your `triviaedu` repo).
3. **Create the Node.js app.** In hPanel, add a Node.js web app for `triviaedu.com` and connect your GitHub repo (or upload a zip of the code without `node_modules`). Use these settings:
   - Framework / preset: **Express** (or "Other")
   - Node version: **20 or 22**
   - Install command: `npm install`
   - Start command: `npm start`, with **`server.js`** as the entry file
4. **Add environment variables** from `.env.example`:
   - `NODE_ENV=production`
   - a long random `SESSION_SECRET`
   - the `DB_*` values from step 1 (`DB_HOST` is usually `localhost`)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`

   Don't set `PORT`. Hostinger provides it.
5. **Deploy**, then open `https://triviaedu.com`. Sign in with the admin email and password. Then add tutors and students, and assign tutors to students.
6. Once you can sign in, change the admin password under **Account Settings**. After that you can remove `ADMIN_PASSWORD` from the environment variables.

> Hostinger's menu names change from time to time. If a label doesn't match, look for the Node.js app's **build settings** and **environment variables** sections.

### Updating
Push to GitHub and redeploy from hPanel. If you change the database schema, add new `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` statements to `src/db/schema.sql`. They run automatically on the next start.

## Project structure

```
server.js              App entry: security headers, sessions, routes
src/config.js          Reads environment variables
src/db/schema.sql      Tables (users, students, assignments, availability, sessions_log, progress_reports)
src/db/migrate.js      Creates tables and the first admin
src/lib/               Middleware (auth, CSRF, flash messages) and date helpers
src/content/contact.js Contact details shown on the public site
src/routes/            site.js (public pages) · auth.js · tutor.js · admin.js
views/                 EJS templates (site, partials, tutor, admin, auth)
.claude/skills/        Project skills for Claude Code
public/                CSS, JS, logo
```

## Typical workflow

1. The admin adds a **tutor**. The app shows a temporary password, which the admin sends to the tutor privately.
2. The admin adds a **student** and assigns a tutor and subject.
3. The tutor signs in, fills in **Available Time**, and logs each session in the **Timesheet**.
4. The admin approves sessions under **Timesheet Review**.
5. At the end of the month, the tutor submits **Progress Reports**. The admin downloads the **Hours Recap** CSV for payroll.
