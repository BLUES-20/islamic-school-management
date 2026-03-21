require('dotenv').config();
const express = require('express');
const session = require('express-session');
const db = require('./config/supabase');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));

app.get('/test-students', async (req, res) => {
  try {
    let studentsRes;
    try {
      studentsRes = await db.query("SELECT * FROM students WHERE payment_status = 'paid' ORDER BY created_at DESC");
    } catch (err) {
      console.log('Fallback triggered:', err.code);
      if (err.code === '42703') {
        studentsRes = await db.query("SELECT * FROM students ORDER BY created_at DESC");
      } else {
        throw err;
      }
    }
    res.json({ success: true, students: studentsRes.rows.length, first: studentsRes.rows[0] });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(10001, () => console.log('Test server on http://localhost:10001/test-students'));

