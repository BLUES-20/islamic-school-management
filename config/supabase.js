// config/supabase.js - Supabase Database Configuration
// Project Ref: wkezgixefbywotgutoao

const {
    Pool
} = require('pg');

// Supabase connection configuration
// Database Host: db.wkezgixefbywotgutoao.supabase.co
// Port: 5432
// Database: postgres

const supabaseConfig = {
    host: process.env.SUPABASE_HOST || 'db.wkezgixefbywotgutoao.supabase.co',
    port: process.env.SUPABASE_PORT || 5432,
    database: process.env.SUPABASE_DB || 'postgres',
    user: process.env.SUPABASE_USER || 'postgres',
    password: process.env.SUPABASE_PASSWORD || '', // Set your Supabase database password
    ssl: {
        rejectUnauthorized: false
    }
};

// Use DATABASE_URL if provided (full connection string), otherwise use individual params
const pool = process.env.DATABASE_URL ?
    new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }) :
    new Pool(supabaseConfig);

// Test connection on startup
pool.connect()
    .then(client => {
            console.log('✅ Supabase PostgreSQL Connected Successfully');
            console.log(`   Project Ref: wkezgixefbywotgutoao`);
            console.log(`   Host: ${supabaseConfig.host}`);
