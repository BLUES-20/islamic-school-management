require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.hammad1007@db.wkezgixefbywotgutoao.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function deleteTestEmails() {
  try {
    const testEmails = ['alladetvs@gmail.com', 'smartshooter80@gmail.com', 'amddev.stack@gmail.com'];
    
    for (const email of testEmails) {
      await pool.query('DELETE FROM payments WHERE student_id IN (SELECT id FROM students WHERE LOWER(email) = LOWER($1) OR LOWER(parent_email) = LOWER($1))', [email]);
      await pool.query('DELETE FROM results WHERE student_id IN (SELECT id FROM students WHERE LOWER(email) = LOWER($1) OR LOWER(parent_email) = LOWER($1))', [email]);
      await pool.query('DELETE FROM students WHERE LOWER(email) = LOWER($1) OR LOWER(parent_email) = LOWER($1)', [email]);
      await pool.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      console.log(`🗑️ Deleted all records for ${email}`);
    }
    console.log('✅ All test emails completely deleted');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

deleteTestEmails();

