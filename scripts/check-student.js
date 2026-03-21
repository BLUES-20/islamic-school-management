require('dotenv').config();
const db = require('../config/supabase');

async function checkStudent(email) {
  try {
    const userRes = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const studentRes = await db.query('SELECT * FROM students WHERE LOWER(email) LIKE LOWER($1) OR LOWER(parent_email) LIKE LOWER($1)', [email]);
    console.log(`User for ${email}:`, userRes.rows.length, userRes.rows);
    console.log(`Student for ${email}:`, studentRes.rows.length, studentRes.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkStudent('alladetvs@gmail.com');

