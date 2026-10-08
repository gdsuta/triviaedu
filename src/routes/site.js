// Public marketing website (content migrated from triviaedu.wordpress.com).
// Mounted in server.js BEFORE the session middleware, so these pages never create sessions.
const router = require('express').Router();
const config = require('../config');
const contact = require('../content/contact');

// One entry per page. `group` groups pages for the header menu; `lang` sets <html lang>.
const pages = [
  { path: '/', view: 'home', title: 'Private Tutors for IB, Cambridge & National Curriculum',
    description: 'Home and online private tutoring in Indonesia for IB, Cambridge (IGCSE, A Level) and national curriculum students. One tutor for one student, English-speaking tutors.' },
  { path: '/ib-tuition', view: 'ib', group: 'programs', label: 'IB Tuition', title: 'IB Tuition (PYP, MYP, DP)',
    description: 'Private tuition for IB PYP, MYP and Diploma Programme students: subject content, Internal Assessment, Extended Essay and exam preparation at SL and HL.' },
  { path: '/cambridge-tuition', view: 'cambridge', group: 'programs', label: 'Cambridge Tuition', title: 'Cambridge Tuition (Checkpoint, IGCSE, AS & A Level)',
    description: 'Private tuition for Cambridge Primary, Lower Secondary Checkpoint, IGCSE, O Level, AS and A Level students, with past exam papers available.' },
  { path: '/les-snbt', view: 'snbt', group: 'programs', label: 'Les SNBT & Ujian Mandiri', title: 'Les SNBT, UTBK & Ujian Mandiri PTN', lang: 'id',
    description: 'Les online semi-privat persiapan UTBK-SNBT, SIMAK UI, SM ITB, UM UGM dan ujian mandiri PTN/PTS bersama tutor lulusan S1 dan S2.' },
  { path: '/les-sekolah-kedinasan', view: 'kedinasan', group: 'programs', label: 'Les Sekolah Kedinasan', title: 'Les Ujian Masuk Sekolah Kedinasan', lang: 'id',
    description: 'Les online privat dan semi-privat persiapan ujian masuk PKN STAN, STIS, AKPOL, STIN, IPDN dan sekolah kedinasan lainnya.' },
  { path: '/les-toefl-ielts', view: 'toefl-ielts', group: 'programs', label: 'Les TOEFL & IELTS', title: 'Les Privat TOEFL dan IELTS', lang: 'id',
    description: 'Les privat TOEFL dan IELTS di rumah atau online dengan tutor berbahasa Inggris yang berpengalaman, lengkap dengan soal latihan.' },
  { path: '/les-privat-mahasiswa', view: 'mahasiswa', group: 'programs', label: 'Les Privat Mahasiswa', title: 'Les Privat Mahasiswa', lang: 'id',
    description: 'Les online privat dan semi-privat untuk mahasiswa: Kalkulus, Aljabar Linier, Matematika Diskret, Metode Numerik, Fisika, Kimia, Ekonomi, Bisnis.' },
  { path: '/ib-or-a-level', view: 'ib-or-a-level', group: 'programs', label: 'Guide: IB or A Level?', title: 'IB Diploma or A Level?',
    description: 'A short guide to the differences between the IB Diploma Programme and A Levels, to help families choose.' },
  { path: '/students', view: 'students', group: 'main', label: 'Students', title: 'Our Students',
    description: 'What our students say, and the international and national schools in Indonesia, Malaysia and the UK whose students we have taught.' },
  { path: '/tutors', view: 'tutors', group: 'main', label: 'Tutors', title: 'Our Tutors',
    description: 'English-speaking Indonesian tutors with bachelor’s and master’s degrees and experience teaching international school students.' },
  { path: '/fees', view: 'fees', group: 'main', label: 'Fees', title: 'Tuition Fee',
    description: 'Tuition fees depend on grade, curriculum and location, starting from IDR 200,000 per online session for primary students.' },
  { path: '/locations', view: 'locations', group: 'main', label: 'Locations', title: 'Locations',
    description: 'Online tutoring across Indonesia and for Indonesian students overseas; home tutoring in Jakarta, Bintaro, Serpong, Bekasi, Depok, Bogor and Denpasar.' },
  { path: '/about', view: 'about', group: 'main', label: 'About', title: 'About Trivia Education',
    description: 'Trivia Education was founded in 2014 by professional tutors teaching international school students in Indonesia.' },
];

router.use((req, res, next) => {
  res.locals.app = { name: config.appName, currency: config.currency };
  res.locals.contact = contact;
  res.locals.path = req.path;
  res.locals.nav = {
    programs: pages.filter((p) => p.group === 'programs'),
    main: pages.filter((p) => p.group === 'main'),
  };
  next();
});

for (const page of pages) {
  router.get(page.path, (req, res) => {
    res.render(`site/${page.view}`, { ...page, lang: page.lang || 'en', canonical: config.appUrl + page.path });
  });
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    'User-agent: *\nDisallow: /login\nDisallow: /tutor\nDisallow: /admin\nDisallow: /account\nDisallow: /portal\n'
    + `Sitemap: ${config.appUrl}/sitemap.xml\n`
  );
});

router.get('/sitemap.xml', (req, res) => {
  const urls = pages.map((p) => `  <url><loc>${config.appUrl}${p.path}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

module.exports = router;
