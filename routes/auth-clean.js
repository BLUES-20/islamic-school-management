// routes/auth-clean.js - FASTEST REGISTRATION (no image, no emails, clean syntax)
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../config/supabase');

// STUDENT LOGIN
router.get('/student-login', (req, res) => res.render('auth/student-login', { title: 'Student Login', page: 'student-login' }));

router.post('/student-login', async (req, res) => {
    const { admission_number, password } = req.body;
    if (!admission_number || !password) return req.flash('error', 'Enter admission/password'), res.redirect('/auth/student-login');

    try {
        const { rows } = await db.query(`
            SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class
            FROM users u JOIN students s ON u.id = s.user_id WHERE s.admission_number = $1 AND u.role = 'student'`, [admission_number]);

        if (!rows.length || !(rows[0].password === password || await bcrypt.compare(password, rows[0].password))) {
            req.flash('error', 'Invalid credentials');
            return res.redirect('/auth/student-login');
        }

        const student = rows[0];
        req.session.student = {
            id: student.id,
            user_id: student.user_id,
            name: `${student.first_name} ${student.last_name}`,
            admission_number: student.admission_number,
            email: student.email,
            class: student.class
        };
        req.flash('success', `Welcome, ${student.first_name}!`);
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        req.flash('error', 'Login failed');
        res.redirect('/auth/student-login');
    }
});

// STUDENT REGISTRATION (ULTRA FAST)
router.get('/student-register', (req, res) => res.render('auth/student-register', { title: 'Registration', page: 'student-register' }));

router.post('/student-register', async (req, res) => {
    console.time('register');
    const { first_name, last_name, email, password, confirm_password, class_name, parent_name, parent_phone } = req.body;
    const full_name = `${first_name} ${last_name}`;

    if (password !== confirm_password || password.length < 6 || !email || !first_name || !last_name) {
        req.flash('error', 'Check form (password match/6+ chars)');
        return res.redirect('/auth/student-register');
    }

    try {
        const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length) return req.flash('error', 'Email registered'), res.redirect('/auth/student-register');

        const hashedPassword = await bcrypt.hash(password, 10);
        const year = new Date().getFullYear();
        const { rows: countResult } = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult[0].count) + 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        const { rows: userResult } = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [email, email, hashedPassword, 'student']
        );
        const user_id = userResult[0].id;

        await db.query(
            'INSERT INTO students (user_id, admission_number, first_name, last_name, email, class, parent_name, parent_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [user_id, admission_number, first_name, last_name, email, class_name, parent_name, parent_phone]
        );

        console.log(`✅ REG OK: ${admission_number} (${full_name})`);

        req.session.pendingRegistration = { admission_number, full_name, email };
        console.timeEnd('register');
        res.redirect('/auth/registration-payment?success=' + admission_number);
    } catch (err) {
        console.timeEnd('register');
        console.error('Reg error:', err);
        req.flash('error', 'Registration failed');
        res.redirect('/auth/student-register');
    }
});

// LOGOUT
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
