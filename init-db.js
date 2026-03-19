// init-db.js - Automatically initialize database tables
const db = require('./config/supabase');

const initDatabase = async () => {
    console.log('🔧 Initializing database...');

    try {
        // Create custom types (if not already created)
        await db.query(`DO $$ BEGIN CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        await db.query(`DO $$ BEGIN CREATE TYPE gender_type AS ENUM ('male', 'female', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);

        // Create Users table
        await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role user_role DEFAULT 'student', reset_password_token VARCHAR(255), reset_password_expires TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Students table with picture column
        await db.query(`CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, admission_number VARCHAR(50) UNIQUE NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, date_of_birth DATE, gender gender_type, class VARCHAR(50), parent_name VARCHAR(100), parent_phone VARCHAR(50), parent_email VARCHAR(255), address TEXT, picture VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Staff table
        await db.query(`CREATE TABLE IF NOT EXISTS staff (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, position VARCHAR(100) NOT NULL, department VARCHAR(100), phone VARCHAR(50), hire_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Sessions table
        await db.query(`CREATE TABLE IF NOT EXISTS sessions (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_token VARCHAR(255) UNIQUE NOT NULL, expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Results table
        await db.query(`CREATE TABLE IF NOT EXISTS results (id SERIAL PRIMARY KEY, student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE, subject VARCHAR(100) NOT NULL, score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100), grade CHAR(1) NOT NULL, term VARCHAR(20) NOT NULL, academic_year VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(student_id, subject, term, academic_year));`);

        // Create Contact Messages table
        await db.query(`CREATE TABLE IF NOT EXISTS contact_messages (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, subject VARCHAR(500) NOT NULL, message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'unread', replied_at TIMESTAMP, reply_message TEXT, staff_reply_id INT REFERENCES staff(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Announcements table
        await db.query(`CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, author_id INT REFERENCES users(id), priority VARCHAR(20) DEFAULT 'normal', status VARCHAR(20) DEFAULT 'published', target_audience VARCHAR(50) DEFAULT 'all', expiry_date DATE, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Documents table
        await db.query(`CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, document_type VARCHAR(50) NOT NULL, file_path TEXT NOT NULL, file_name TEXT NOT NULL, file_size INT, target_audience VARCHAR(50) DEFAULT 'all', author_id INT REFERENCES users(id), uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Create Payments table
        await db.query(`CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, student_id INT REFERENCES students(id) ON DELETE CASCADE, tx_ref VARCHAR(255) UNIQUE NOT NULL, flw_transaction_id VARCHAR(255), amount DECIMAL(10,2) NOT NULL, currency VARCHAR(10) DEFAULT 'NGN', payment_type VARCHAR(50) DEFAULT 'registration', status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

        // Alter existing tables to increase phone field limits
        try {
            await db.query(`ALTER TABLE students ALTER COLUMN parent_phone TYPE VARCHAR(50);`);
            await db.query(`ALTER TABLE staff ALTER COLUMN phone TYPE VARCHAR(50);`);
        } catch (e) {
            // Column might already be the correct size or table might not exist yet
        }

        // Insert default admin user if not exists
        const bcrypt = require('bcrypt');
        const adminExists = await db.query("SELECT id FROM users WHERE username = 'admin'");

        if (adminExists.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query(`INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@school.com', $1, 'admin')`, [hashedPassword]);
            console.log('✅ Default admin user created (admin@school.com / admin123)');
        }

        // Add picture column to students if missing
        try {
            await db.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS picture VARCHAR(500)`);
        } catch (e) {}

        console.log('✅ Database tables initialized successfully!');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
    }
};

module.exports = initDatabase;
