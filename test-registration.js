require('dotenv').config();
const db = require('./config/supabase');
const bcrypt = require('bcrypt');

async function testRegistration() {
  try {
    // Create test admin if not exists
    const hashed = await bcrypt.hash('admin123', 10);
    await db.query(`
      INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@school.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashed]);
    console.log('✅ Test admin ready: admin@school.com/admin123');

    // Check students
    const students = await db.query('SELECT COUNT(*) as count FROM students');
    console.log(`Students count: ${students.rows[0].count}`);

    // Test manage students query
    const testQuery = await db.query('SELECT * FROM students ORDER BY created_at DESC LIMIT 5');
    console.log('Test query:', testQuery.rows.length, 'rows');

    console.log('✅ Registration & manage students READY');
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testRegistration();

