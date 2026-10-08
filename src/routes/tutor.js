const router = require('express').Router();
const { query, one, pool } = require('../db/pool');
const { ah, requireRole } = require('../lib/middleware');
const d = require('../lib/dates');

router.use(requireRole('tutor'));

const pickPeriod = (p) => (d.isPeriod(p) ? p : d.currentPeriod());

async function myAssignments(tutorId) {
  return query(
    `SELECT a.student_id, a.subject, s.name AS student_name
       FROM assignments a JOIN students s ON s.id = a.student_id
      WHERE a.tutor_id = ? AND s.is_active = 1
      ORDER BY s.name, a.subject`, [tutorId]);
}

// ---------- Dashboard: calendar + monthly summary ----------
router.get('/', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const { start, end } = d.periodRange(period);
  const weeks = d.monthGrid(period);
  const gridStart = weeks[0][0].date;
  const gridEnd = weeks[weeks.length - 1][6].date;

  const sessions = await query(
    `SELECT l.id, l.session_date, l.start_time, l.end_time, l.subject, l.status, s.name AS student_name
       FROM sessions_log l JOIN students s ON s.id = l.student_id
      WHERE l.tutor_id = ? AND l.session_date BETWEEN ? AND ?
      ORDER BY l.session_date, l.start_time`, [req.user.id, gridStart, gridEnd]);
  const byDate = {};
  for (const s of sessions) (byDate[s.session_date] ||= []).push(s);

  const summary = await one(
    `SELECT COUNT(*) AS activities,
            COALESCE(SUM(minutes), 0) AS minutes,
            COALESCE(SUM(CASE WHEN status = 'approved' THEN minutes END), 0) AS approved_minutes,
            COALESCE(SUM(status = 'pending'), 0) AS pending
       FROM sessions_log WHERE tutor_id = ? AND session_date BETWEEN ? AND ?`, [req.user.id, start, end]);
  const students = await one('SELECT COUNT(DISTINCT student_id) AS n FROM assignments WHERE tutor_id = ?', [req.user.id]);

  const selected = req.query.day && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : d.today();
  res.render('tutor/dashboard', {
    title: 'Dashboard', period, weeks, byDate, summary, studentCount: students.n,
    selected, dayEvents: byDate[selected] || [],
    prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1), todayIso: d.today(),
  });
}));

// ---------- Availability grid ----------
router.get('/availability', ah(async (req, res) => {
  const rows = await query('SELECT day_of_week, slot_start FROM availability WHERE tutor_id = ?', [req.user.id]);
  const set = new Set(rows.map((r) => `${r.day_of_week}|${r.slot_start}`));
  res.render('tutor/availability', { title: 'Available Time', set, editing: req.query.edit === '1' });
}));

router.post('/availability', ah(async (req, res) => {
  let picked = req.body.slots || [];
  if (!Array.isArray(picked)) picked = [picked];
  const valid = new Set(d.SLOTS.map((s) => s.start));
  const rows = [];
  for (const v of picked) {
    const [day, slot] = String(v).split('|');
    const n = Number(day);
    if (n >= 1 && n <= 7 && valid.has(slot)) rows.push([req.user.id, n, slot]);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM availability WHERE tutor_id = ?', [req.user.id]);
    if (rows.length) await conn.query('INSERT IGNORE INTO availability (tutor_id, day_of_week, slot_start) VALUES ?', [rows]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  req.flash('success', `Availability saved (${rows.length} half-hour slots).`);
  res.redirect('/tutor/availability');
}));

// ---------- Timesheet ----------
async function validateSession(req, body) {
  const errors = [];
  const [studentId, ...subj] = String(body.assignment || '').split('|');
  const subject = subj.join('|');
  const asg = await one('SELECT 1 FROM assignments WHERE tutor_id = ? AND student_id = ? AND subject = ?', [req.user.id, Number(studentId), subject]);
  if (!asg) errors.push('Choose one of your students.');
  const date = String(body.session_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Pick a valid date.');
  else if (date > d.today()) errors.push('You can only log sessions that already happened.');
  const s = d.toMinutes(body.start_time); const e = d.toMinutes(body.end_time);
  if (s === null || e === null) errors.push('Enter start and end times.');
  else if (e <= s) errors.push('End time must be after start time.');
  else if (e - s > 6 * 60) errors.push('A single session cannot be longer than 6 hours.');
  const mode = body.mode === 'offline' ? 'offline' : 'online';
  return {
    errors,
    data: {
      student_id: Number(studentId), subject, session_date: date, start_time: body.start_time, end_time: body.end_time,
      minutes: s !== null && e !== null ? e - s : 0, mode,
      topic: String(body.topic || '').trim().slice(0, 255) || null,
      notes: String(body.notes || '').trim().slice(0, 2000) || null,
    },
  };
}

async function overlaps(tutorId, data, excludeId = 0) {
  return one(
    `SELECT id FROM sessions_log WHERE tutor_id = ? AND session_date = ? AND id <> ? AND status <> 'rejected'
        AND start_time < ? AND end_time > ? LIMIT 1`,
    [tutorId, data.session_date, excludeId, data.end_time, data.start_time]);
}

router.get('/timesheet', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const { start, end } = d.periodRange(period);
  const rows = await query(
    `SELECT l.*, s.name AS student_name FROM sessions_log l JOIN students s ON s.id = l.student_id
      WHERE l.tutor_id = ? AND l.session_date BETWEEN ? AND ?
      ORDER BY l.session_date DESC, l.start_time DESC`, [req.user.id, start, end]);
  const totals = rows.reduce((t, r) => { t.all += r.minutes; if (r.status === 'approved') t.approved += r.minutes; return t; }, { all: 0, approved: 0 });
  res.render('tutor/timesheet', { title: 'Tutoring Timesheet', period, rows, totals, prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1) });
}));

router.get('/timesheet/new', ah(async (req, res) => {
  res.render('tutor/session-form', {
    title: 'Log a session', assignments: await myAssignments(req.user.id),
    s: { session_date: req.query.date || d.today(), start_time: '', end_time: '', mode: 'online' }, errors: [],
  });
}));

router.post('/timesheet', ah(async (req, res) => {
  const { errors, data } = await validateSession(req, req.body);
  if (!errors.length && (await overlaps(req.user.id, data))) errors.push('This overlaps with another session you logged that day.');
  if (errors.length) {
    return res.status(422).render('tutor/session-form', { title: 'Log a session', assignments: await myAssignments(req.user.id), s: { ...data, assignment: req.body.assignment }, errors });
  }
  await query('INSERT INTO sessions_log SET ?', [{ ...data, tutor_id: req.user.id }]);
  req.flash('success', 'Session logged. It will be reviewed by an admin.');
  res.redirect(`/tutor/timesheet?month=${data.session_date.slice(0, 7)}`);
}));

async function ownEditable(req) {
  const s = await one('SELECT * FROM sessions_log WHERE id = ? AND tutor_id = ?', [Number(req.params.id), req.user.id]);
  return s && s.status !== 'approved' ? s : null;
}

router.get('/timesheet/:id/edit', ah(async (req, res) => {
  const s = await ownEditable(req);
  if (!s) { req.flash('error', 'That session cannot be edited.'); return res.redirect('/tutor/timesheet'); }
  s.assignment = `${s.student_id}|${s.subject}`;
  res.render('tutor/session-form', { title: 'Edit session', assignments: await myAssignments(req.user.id), s, errors: [] });
}));

router.post('/timesheet/:id', ah(async (req, res) => {
  const existing = await ownEditable(req);
  if (!existing) { req.flash('error', 'That session cannot be edited.'); return res.redirect('/tutor/timesheet'); }
  const { errors, data } = await validateSession(req, req.body);
  if (!errors.length && (await overlaps(req.user.id, data, existing.id))) errors.push('This overlaps with another session you logged that day.');
  if (errors.length) {
    return res.status(422).render('tutor/session-form', { title: 'Edit session', assignments: await myAssignments(req.user.id), s: { ...data, id: existing.id, assignment: req.body.assignment }, errors });
  }
  // An edited session goes back to the review queue
  await query("UPDATE sessions_log SET ?, status = 'pending', admin_note = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?", [data, existing.id]);
  req.flash('success', 'Session updated and sent for review again.');
  res.redirect(`/tutor/timesheet?month=${data.session_date.slice(0, 7)}`);
}));

router.post('/timesheet/:id/delete', ah(async (req, res) => {
  const s = await ownEditable(req);
  if (s) { await query('DELETE FROM sessions_log WHERE id = ?', [s.id]); req.flash('success', 'Session removed.'); }
  else req.flash('error', 'Approved sessions cannot be removed.');
  res.redirect('/tutor/timesheet');
}));

// ---------- Progress reports ----------
router.get('/reports', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const assignments = await myAssignments(req.user.id);
  const reports = await query('SELECT * FROM progress_reports WHERE tutor_id = ? AND period = ?', [req.user.id, period]);
  const map = {};
  for (const r of reports) map[`${r.student_id}|${r.subject}`] = r;
  const { start, end } = d.periodRange(period);
  const counts = await query(
    `SELECT student_id, subject, COUNT(*) AS n, SUM(minutes) AS minutes FROM sessions_log
      WHERE tutor_id = ? AND session_date BETWEEN ? AND ? AND status <> 'rejected' GROUP BY student_id, subject`,
    [req.user.id, start, end]);
  const cmap = {};
  for (const c of counts) cmap[`${c.student_id}|${c.subject}`] = c;
  res.render('tutor/reports', { title: 'Progress Report', period, assignments, map, cmap, prev: d.shiftPeriod(period, -1), next: d.shiftPeriod(period, 1) });
}));

router.get('/reports/edit', ah(async (req, res) => {
  const period = pickPeriod(req.query.month);
  const studentId = Number(req.query.student);
  const subject = String(req.query.subject || '');
  const asg = await one(
    `SELECT a.student_id, a.subject, s.name AS student_name FROM assignments a JOIN students s ON s.id = a.student_id
      WHERE a.tutor_id = ? AND a.student_id = ? AND a.subject = ?`, [req.user.id, studentId, subject]);
  if (!asg) { req.flash('error', 'Student not found.'); return res.redirect('/tutor/reports'); }
  const report = (await one('SELECT * FROM progress_reports WHERE tutor_id = ? AND student_id = ? AND subject = ? AND period = ?',
    [req.user.id, studentId, subject, period])) || { status: 'draft' };
  const { start, end } = d.periodRange(period);
  const sessions = await query(
    `SELECT session_date, start_time, end_time, topic FROM sessions_log
      WHERE tutor_id = ? AND student_id = ? AND subject = ? AND session_date BETWEEN ? AND ? AND status <> 'rejected'
      ORDER BY session_date`, [req.user.id, studentId, subject, start, end]);
  res.render('tutor/report-form', { title: 'Progress Report', period, asg, report, sessions });
}));

router.post('/reports', ah(async (req, res) => {
  const period = pickPeriod(req.body.period);
  const studentId = Number(req.body.student_id);
  const subject = String(req.body.subject || '');
  const asg = await one('SELECT 1 FROM assignments WHERE tutor_id = ? AND student_id = ? AND subject = ?', [req.user.id, studentId, subject]);
  if (!asg) { req.flash('error', 'Student not found.'); return res.redirect('/tutor/reports'); }
  const existing = await one('SELECT id, status FROM progress_reports WHERE tutor_id = ? AND student_id = ? AND subject = ? AND period = ?', [req.user.id, studentId, subject, period]);
  if (existing && existing.status === 'submitted') { req.flash('error', 'This report was already submitted.'); return res.redirect(`/tutor/reports?month=${period}`); }
  const rating = Number(req.body.rating);
  const clean = (k) => String(req.body[k] || '').trim().slice(0, 4000) || null;
  const submit = req.body.action === 'submit';
  const data = {
    rating: rating >= 1 && rating <= 5 ? rating : null,
    covered: clean('covered'), strengths: clean('strengths'), improvements: clean('improvements'), next_steps: clean('next_steps'),
    status: submit ? 'submitted' : 'draft', submitted_at: submit ? new Date() : null,
  };
  if (submit && (!data.rating || !data.covered || !data.next_steps)) {
    req.flash('error', 'To submit, fill in the rating, what was covered, and next steps.');
    if (existing) await query('UPDATE progress_reports SET ? WHERE id = ?', [{ ...data, status: 'draft', submitted_at: null }, existing.id]);
    else await query('INSERT INTO progress_reports SET ?', [{ ...data, status: 'draft', submitted_at: null, tutor_id: req.user.id, student_id: studentId, subject, period }]);
    return res.redirect(`/tutor/reports/edit?month=${period}&student=${studentId}&subject=${encodeURIComponent(subject)}`);
  }
  if (existing) await query('UPDATE progress_reports SET ? WHERE id = ?', [data, existing.id]);
  else await query('INSERT INTO progress_reports SET ?', [{ ...data, tutor_id: req.user.id, student_id: studentId, subject, period }]);
  req.flash('success', submit ? 'Report submitted.' : 'Draft saved.');
  res.redirect(`/tutor/reports?month=${period}`);
}));

module.exports = router;
