const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'hammad1007',
    database: 'school_db',
    ssl: false
});

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected with FIXED config!');
    client.release();
  })
  .catch(err => {
    console.error('❌ FIXED config failed:', err.message);
  });

module.exports = pool;

