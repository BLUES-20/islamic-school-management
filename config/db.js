// config/db.js
const { Pool } = require('pg');

// Use DATABASE_URL for production (Render), fallback to local config
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : new Pool({
      host: process.env.DB_HOST || 'dpg-d6ofa24r85hc739dj8p0-a.oregon-postgres.render.com',
      user: process.env.DB_USER || 'islamic_school_db_user',
      password: process.env.DB_PASSWORD || 'gT8QBtf9dWXUSHWsvwh9tvgC9WKoPX3k',
      database: process.env.DB_NAME || 'islamic_school_db',
      port: process.env.DB_PORT || 5432,
      ssl: {
        rejectUnauthorized: false
      }
    });

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err);
  });

module.exports = pool;
