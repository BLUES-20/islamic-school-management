// config/db.js - Local PostgreSQL (pgAdmin4)
const { Pool } = require('pg');

// Connect to local PostgreSQL (pgAdmin4)
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'postgres',
    database: 'school_management',
    port: 5432,
    ssl: false
});

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected (pgAdmin4 local)');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });

module.exports = pool;

