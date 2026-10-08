const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, one } = require('../db/pool');
const { ah, requireRole } = require('../lib/middleware');
const d = require('../lib/dates');

router.use(requireRole('admin'));

const pickPeriod = (p) => (d.isPeriod(p) ? p : d.currentPeriod());
const str = (v, max = 255) => String(v || '').trim().slice(0, max) || null;
const tempPassword = () => crypto.randomBytes(6).toString('base64url');

// ---------- Overview ----------
router.get('/', ah(async (req, res) => {
  const period = d.currentPeriod();
  const { start, end } = d.periodRange(period);
  const stats = await one(
    `SELECT (SELECT COUNT(*) FROM users WHERE role = 'tutor' AND is_active = 1) AS tutors,
            (SELECT COUNT(*) FROM students WHERE is_active = 1) AS students,
            (SELECT COUNT(*) FROM sessions_log WHERE status = 'pending') AS pending,
            (SELECT COALESCE(SUM(minutes),0) FROM sessions_log WHERE status = 'approved' AND session_date BETWEEN ? AND ?) AS approved_minutes,
            (SELECT COUNT(*) FROM progress_reports WHERE status = 'submitted' AND period = ?) AS reports`,
    [start, end, period]);
  const recent = await query(
    `SELECT l.id, l.session_date, l.start_time, l.end_time, l.subject, l.minutes, u.name AS tutor_name, s.name AS student_name
       FROM sessions_log l JOIN users u ON u.id = l.tutor_id JOIN students s ON s.id = l.student_id
      WHERE l.status = 'pending' ORDER BY l.session_date DESC, l.start_time DESC LIMIT 8`);
  res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recent, period });
}));

// ---------- Tutors ----------
router.get('/tutors', ah(async (req, res) => {
  const tutors = await query(
    `SELECT u.*, (SELECT COUNT(*) FROM assignments a WHERE a.tutor_id = u.id) AS assignment_count
       FROM users u WHERE u.role = 'tutor' ORDER BY u.is_active DESC, u.name`);
  res.render('admin/tutors', { title: 'Tutors', tutors });
}));

router.get('/tutors/new', (req, res) => res.render('admin/tutor-form', { title: 'Add tutor', t: { is_active: 1 }, errors: [] }));

router.get('/tutors/:id', ah(async (req, res) => {
  const t = await one("SELECT * FROM users WHERE id = ? AND role = 'tutor'", [Number(req.params.id)]);
  if (!t) return res.redirect('/admin/tutors');
  const avail = await query('SELECT day_of_week, slot_start FROM availability WHERE tutor_id = ?', [t.id]);
  const set = new Set(avail.map((r) => `${r.day_of_week}|${r.slot_start}`));
  const assignments = await query(
    `SELECT a.id, a.subject, s.name AS student_name, s.id AS student_id FROM assignments a JOIN students s ON s.id = a.student_id
      WHERE a.tutor_id = ? ORDER BY s.name`, [t.id]);
  res.render('admin/tutor-form', { title: t.name, t, errors: [], set, assignments });
}));

async function saveTutor(req, res, id) {
  const b = req.body;
  const t = {
    name: str(b.name, 120), email: String(b.email || '').trim().toLowerCase(), phone: str(b.phone, 40),
    subjects: str(b.subjects), hourly_rate: Math.max(0, Number(b.hourly_rate) || 0), is_active: b.is_active ? 1 : 0,
  };
  const errors = [];
  if (!t.name) errors.push('Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) errors.push('Enter a valid email.');
  const clash = await one('SELECT id FROM users WHERE email = ? AND id <> ?', [t.email, id || 0]);
  if (clash) errors.push('Another account already uses this email.');
  if (errors.length) return res.status(422).render('admin/tutor-form', { title: id ? 'Edit tutor' : 'Add tutor', t: { ...t, id }, errors });

  if (id) {
    await query("UPDATE users SET ? WHERE id = ? AND role = 'tutor'", [t, id]);
    req.flash('success', 'Tutor updated.');
    return res.redirect(`/admin/tutors/${id}`);
  }
  const pw = tempPassword();
  const r = await query('INSERT INTO users SET ?', [{ ...t, role: 'tutor', password_hash: await bcrypt.hash(pw, 10) }]);
  req.flash('success', `Tutor added. Temporary password: ${pw} — share it with them privately; they can change it in Account Settings.`);
  res.redirect(`/admin/tutors/${r.insertId}`);
}

router.post('/tutors', ah((req, res) => saveTutor(req, res, null)));
router.post('/tutors/:id', ah((req, res) => saveTutor(req, res, Number(req.params.id))));

router.post('/tutors/:id/reset-password', ah(async (req, res) => {
  const id = Number(req.params.id);
  const pw = tempPassword();
  await query("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'tutor'", [await bcrypt.hash(pw, 10), id]);
  req.flash('success', `New temporary password: ${pw}`);
  res.redirect(`/admin/tutors/${id}`);
}));

// ---------- Students & assignments ----------
router.get('/students', ah(async (req, res) => {
  const students = await query(
    `SELECT s.*, GROUP_CONCAT(CONCAT(u.name, ' (', a.subject, ')') ORDER BY u.name SEPARATOR ', ') AS tutors
       FROM students s LEFT JOIN assignments a ON a.student_id = s.id LEFT JOIN users u ON u.id = a.tutor_id
      GROUP BY s.id ORDER BY s.is_active DESC, s.name`);
  res.render('admin/students', { title: 'Students', students });
}));

router.get('/students/new', ah(async (req, res) => res.render('admin/student-form', { title: 'Add student', s: { is_active: 1 }, errors: [], assignments: [], tutors: [] })));

router.get('/students/:id', ah(async (req, res) => {
  const s = await one('SELECT * FROM students WHERE id = ?', [Number(req.params.id)]);
  if (!s) return res.redirect('/admin/students');
  const assignments = await query(
    `SELECT a.id, a.subject, u.name AS tutor_name FROM assignments a JOIN users u ON u.id = a.tutor_id WHERE a.student_id = ? ORDER BY u.name`, [s.id]);
  const tutors = await query("SELECT id, name, subjects FROM users WHERE role = 'tutor' AND is_active = 1 ORDER BY name");
  res.render('admin/student-form', { title: s.name, s, errors: [], assignments, tutors });
}));

async function saveStudent(req, res, id) {
  const b = req.body;
  const s = {
    name: str(b.name, 120), grade: str(b.grade, 40), school: str(b.school, 160), parent_name: str(b.parent_name, 120),
    parent_phone: str(b.parent_phone, 40), parent_email: str(b.parent_email, 190), notes: str(b.notes, 2000), is_active: b.is_active ? 1 : 0,
  };
  if (!s.name) return res.status(422).render('admin/student-form', { title: 'Student', s: { ...s, id }, errors: ['Name is required.'], assignments: [], tutors: [] });
  if (id) { await query('UPDATE students SET ? WHERE id = ?', [s, id]); req.flash('success', 'Student updated.'); return res.redirect(`/admin/students/${id}`); }
  const r = await query('INSERT INTO students SET ?', [s]);
  req.flash('success', 'Student added. Now assign a tutor below.');
  res.redirect(`/admin/students/${r.insertId}`);
}
router.post('/students', ah((req, res) => saveStudent(req, res, null)));
router.post('/students/:id', ah((req, res) => saveStudent(req, res, Number(req.params.id))));

router.post('/students/:id/assign', ah(async (req, res) => {
  const studentId = Number(req.params.id);
  const tutorId = Number(req.body.tutor_id);
  const subject = str(req.body.subject, 120);
  const tutor = await one("SELECT id FROM users WHERE id = ? AND role = 'tutor'", [tutorId]);
  if (!tutor || !subject) req.flash('error', 'Pick a tutor and enter a subject.');
  else { await query('INSERT IGNORE INTO assignments (tutor_id, student_id, subject) VALUES (?, ?, ?)', [tutorId, studentId, subject]); req.flash('success', 'Tutor assigned.'); }
  res.redirect(`/admin/students/${studentId}`);
}));

router.post('/assignments/:id/delete', ah(async (req, res) => {
  const a = await one('SELECT student_id FROM assignments WHERE id = ?', [Number(req.params.id)]);
  if (a) { await query('DELETE FROM assignments WHERE id = ?', [Number(req.params.id)]); req.flash('success', 'Assignment removed. Past sessions are kept.'); }
  res.redirect(req.get('referer') && req.get('referer').includes('/admin/') ? req.get('referer') : '/admin/students');
}));

// ---------- Timesheet review ----------
router.get('/timesheets', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const { start, end } = d.periodRange(period);
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : '';
  const tutorId = Number(req.query.tutor) || 0;
  const where = ['l.session_date BETWEEN ? AND ?']; const params = [start, end];
  if (status) { where.push('l.status = ?'); params.push(status); }
  if (tutorId) { where.push('l.tutor_id = ?'); params.push(tutorId); }
  const rows = await query(
    `SELECT l.*, u.name AS tutor_name, s.name AS student_name FROM sessions_log l
       JOIN users u ON u.id = l.tutor_id JOIN students s ON s.id = l.student_id
      WHERE ${where.join(' AND ')} ORDER BY l.session_date DESC, l.start_time DESC`, params);
  const tutors = await query("SELECT id, name FROM users WHERE role = 'tutor' ORDER BY name");
  res.render('admin/timesheets', { title: 'Timesheet Review', period, rows, tutors, status, tutorId, prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1) });
}));

router.post('/timesheets/review', ah(async (req, res) => {
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.map(Number).filter(Boolean);
  const action = req.body.action === 'reject' ? 'rejected' : 'approved';
  if (ids.length) {
    await query('UPDATE sessions_log SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id IN (?)',
      [action, str(req.body.admin_note), req.user.id, ids]);
    req.flash('success', `${ids.length} session(s) ${action}.`);
  } else req.flash('error', 'Select at least one session.');
  res.redirect(req.get('referer') && req.get('referer').includes('/admin/timesheets') ? req.get('referer') : '/admin/timesheets');
}));

// ---------- Monthly hours recap (for payroll) ----------
async function recap(period) {
  const { start, end } = d.periodRange(period);
  return query(
    `SELECT u.id, u.name, u.email, u.hourly_rate,
            COUNT(l.id) AS sessions,
            COALESCE(SUM(CASE WHEN l.status = 'approved' THEN l.minutes END), 0) AS approved_minutes,
            COALESCE(SUM(CASE WHEN l.status = 'pending' THEN l.minutes END), 0) AS pending_minutes
       FROM users u LEFT JOIN sessions_log l ON l.tutor_id = u.id AND l.session_date BETWEEN ? AND ?
      WHERE u.role = 'tutor' GROUP BY u.id HAVING sessions > 0 OR MAX(u.is_active) = 1 ORDER BY u.name`, [start, end]);
}

router.get('/recap', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  res.render('admin/recap', { title: 'Hours Recap', period, rows: await recap(period), prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1) });
}));

router.get('/recap.csv', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const rows = await recap(period);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Tutor', 'Email', 'Sessions', 'Approved hours', 'Pending hours', 'Hourly rate', 'Amount (approved)'].map(esc).join(',')];
  for (const r of rows) {
    const hrs = r.approved_minutes / 60;
    lines.push([r.name, r.email, r.sessions, hrs.toFixed(2), (r.pending_minutes / 60).toFixed(2), r.hourly_rate, (hrs * r.hourly_rate).toFixed(0)].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trivia-hours-${period}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}));

// ---------- Progress reports ----------
router.get('/reports', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const rows = await query(
    `SELECT r.*, u.name AS tutor_name, s.name AS student_name FROM progress_reports r
       JOIN users u ON u.id = r.tutor_id JOIN students s ON s.id = r.student_id
      WHERE r.period = ? ORDER BY r.status DESC, s.name`, [period]);
  res.render('admin/reports', { title: 'Progress Reports', period, rows, prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1) });
}));

router.get('/reports/:id', ah(async (req, res) => {
  const r = await one(
    `SELECT r.*, u.name AS tutor_name, s.name AS student_name, s.grade, s.school, s.parent_name FROM progress_reports r
       JOIN users u ON u.id = r.tutor_id JOIN students s ON s.id = r.student_id WHERE r.id = ?`, [Number(req.params.id)]);
  if (!r) return res.redirect('/admin/reports');
  res.render('admin/report-view', { title: `Report: ${r.student_name}`, r });
}));

router.post('/reports/:id/reopen', ah(async (req, res) => {
  await query("UPDATE progress_reports SET status = 'draft', submitted_at = NULL WHERE id = ?", [Number(req.params.id)]);
  req.flash('success', 'Report returned to the tutor as a draft.');
  res.redirect('/admin/reports');
}));

module.exports = router;
