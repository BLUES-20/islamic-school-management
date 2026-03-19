const { Pool } = require('pg');

const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hammad1007',
    database: 'school_db',
    ssl: false
});

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected (local pgAdmin)');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('Hint: Check pgAdmin password for "postgres" user or DB_NAME=school_db exists.');
  });

module.exports = pool;

