---
name: site-content
description: Add, edit or remove pages on the triviaedu.com public website (programs, fees, locations, testimonials, subjects, contact details). Use when the user asks to change website text, add a new program or page, update prices or contact info, or migrate more content from the old WordPress site.
---

# Editing the public website

The public site is server-rendered EJS. There is no CMS and no database.

## Where things live

- `src/routes/site.js`: the `pages` array is the registry. Each entry has `path`, `view`, `title` (used in `<title>` and og:title), `description` (meta description, ~150 chars), optional `group` (`'programs'` or `'main'`, which puts the page in the header and footer menus), optional `label` (menu text) and optional `lang: 'id'` for Indonesian pages. The sitemap is generated from this array.
- `views/site/<view>.ejs`: page body.
- `views/site/partials/`: `head.ejs` (header and menu), `foot.ejs` (footer and WhatsApp button), `cta.ejs` (contact banner; switches to Indonesian when `lang === 'id'`).
- `src/content/contact.js`: phone, WhatsApp, email, address and founding year. Change contact details here only.
- `public/css/site.css`: public styles (uses tokens from `app.css`).
- `public/img/site/`: images. Always set `width`, `height`, `alt` and `loading="lazy"`.

## Page skeleton

```ejs
<%- include('partials/head') %>
<section class="page-hero">
  <div class="site-wrap">
    <p class="eyebrow">Short kicker</p>
    <h1>Page heading</h1>
    <p class="lead">One or two sentence summary.</p>
  </div>
</section>
<div class="site-wrap">
  <section class="section split-2"> … </section>
  <%- include('partials/cta') %>
</div>
<%- include('partials/foot') %>
```

Building blocks in `site.css`: `.section`, `.split-2`, `.panel`, `.prose`, `.card-grid` + `.pcard`, `ul.ticks`, `ul.chips`, `ul.plain`, `.quotes` (blockquote + cite), `.school-grid`, `.price`, `.photo`; buttons come from `app.css` (`.btn`, `.btn-ghost`).

## Rules

- Helmet CSP blocks inline scripts and `style=""` attributes. Add a class in `site.css` instead.
- Keep the voice factual and short. Don't invent testimonials, results, schools or prices. Ask the owner.
- Don't copy third-party articles. Summarise them in your own words and link to the source.
- Public pages have no session, `user` or `csrf`. Don't add forms that POST to the portal.
- If you edit `site.css` or `app.js`, bump the `?v=` in `views/site/partials/head.ejs` / `foot.ejs`.

## Verify

```bash
PORT=3123 node server.js &   # public pages work without a database
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3123/<path>
curl -s http://localhost:3123/sitemap.xml
```

Check the page in a browser at desktop width and about 400px width, in both light and dark themes.
