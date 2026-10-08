const config = require('../config');

// Today's date (YYYY-MM-DD) in the business timezone
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function currentPeriod() { return today().slice(0, 7); }

function isPeriod(p) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(p || ''); }

function periodRange(period) {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}`, year: y, month: m, days: last };
}

function shiftPeriod(period, delta) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Monday-first calendar grid: array of weeks, each an array of 7 {date, inMonth}
function monthGrid(period) {
  const { year, month } = periodRange(period);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const start = new Date(first); start.setUTCDate(1 - offset);
  const weeks = [];
  const cur = new Date(start);
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = cur.toISOString().slice(0, 10);
      week.push({ date: iso, day: cur.getUTCDate(), inMonth: cur.getUTCMonth() === month - 1 });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cur.getUTCMonth() === month - 1);
  return weeks;
}

function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtHours(minutes) {
  const h = (Number(minutes) || 0) / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, '');
}

// 30-minute slots used by the availability grid
const SLOTS = [];
for (let t = 8 * 60; t < 22 * 60; t += 30) {
  const hh = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  SLOTS.push({ start: hh(t), end: hh(t + 30) });
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

module.exports = { today, currentPeriod, isPeriod, periodRange, shiftPeriod, periodLabel, monthGrid, toMinutes, fmtDate, fmtHours, SLOTS, DAYS };
