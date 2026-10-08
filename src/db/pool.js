const mysql = require('mysql2/promise');
const { db } = require('../config');

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 5, // shared hosting: keep this small
  dateStrings: true,  // DATE/DATETIME come back as plain strings, no timezone shifts
  charset: 'utf8mb4',
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { pool, query, one };
