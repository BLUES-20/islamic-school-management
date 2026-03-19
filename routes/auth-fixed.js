// routes/auth-fixed.js - FAST REGISTRATION (no image, no emails)
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const https = require('https');
const router = express.Router();
const db = require('../config/supabase');
const emailService = require('../services/email');
const multer = require('multer');
const path = require('path');

// Helper function to verify Google reCAPTCHA v2
function verifyRecaptcha(token) {
    return new Promise((resolve) => {
        const secret = process.env.GOOGLE_RECAPTCHA_SECRET;
        if (!secret) return resolve(true);
        const postData = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token || '')}`;
        const options = {
            hostname: 'www.google.com',
            port: 443,
            path: '/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.success === true);
                } catch (e) {
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
    });
}

// Helper function to send email using email service (Resend, SMTP, or Gmail)
async function sendEmail(to, subject, html) {
    return emailService.sendEmail(to, subject, html);
}

// Configure Multer for future use (profile pics)
const { studentStorage } = require('../config/cloudinary');
const uploadPicture = multer({
    storage: studentStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only JPG, JPEG and PNG images are allowed!'));
    }
});

// =================== STUDENT LOGIN ===================
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', { title: 'Student Login - Islamic School', page: 'student-login' });
});

router.post('/student-login', async (req, res) => {
    const { admission_number, password } = req.body;
    if (!admission_number || !password) {
        req.flash('error', 'Please enter admission number and password');
        return res.redirect('/auth/student-login');
    }

    if (process.env.GOOGLE_RECAPTCHA_SECRET && process.env.GOOGLE_RECAPTCHA_SITE_KEY) {
        const recaptchaToken = req.body['g-recaptcha-response'];
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            req.flash('error', 'Please complete the reCAPTCHA verification');
            return res.redirect('/auth/student-login');
        }
    }

    try {
        const { rows } = await db.query(`
            SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class, s.picture
            FROM users u JOIN students s ON u.id = s.user_id
            WHERE s.admission_number = $1 AND u.role = 'student'`, [admission_number]);

        if (!rows.length) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        const student = rows[0];
        let match = student.password === password || await bcrypt.compare(password, student.password);

        if (!match) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        req.session.student = {
            id: student.id,
            user_id: student.user_id,
            name: `${student.first_name} ${student.last_name}`,
            admission_number: student.admission_number,
            email: student.email,
            class: student.class,
            picture: student.picture
        };

        req.flash('success', `Welcome back, ${student.first_name}!`);
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error('Student login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/student-login');
    }
});

// =================== STAFF LOGIN ===================
router.get('/staff-login', (req, res) => {
    res.render('auth/staff-login', { title: 'Staff Login - Islamic School', page: 'staff-login' });
});

router.post('/staff-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    if (process.env.GOOGLE_RECAPTCHA_SECRET && process.env.GOOGLE_RECAPTCHA_SITE_KEY) {
        const recaptchaToken = req.body['g-recaptcha-response'];
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            req.flash('error', 'Please complete the reCAPTCHA verification');
            return res.redirect('/auth/staff-login');
        }
    }

    try {
        const { rows } = await db.query(`
            SELECT u.id as user_id, u.password, u.role, u.email, s.id as staff_id, s.first_name, s.last_name, s.position
            FROM users u LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.email = $1 AND u.role IN ('staff', 'admin')`, [email]);

        if (!rows.length) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        const user = rows[0];
        let match = user.password === password || await bcrypt.compare(password, user.password);

        if (!match) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        req.session.staff = {
            id: user.staff_id || user.user_id,
            user_id: user.user_id,
            name: user.first_name ? `${user.first_name} ${user.last_name}` : 'Administrator',
            email: user.email,
            position: user.position || 'Admin',
            role: user.role
        };

        req.flash('success', `Welcome back, ${req.session.staff.name}!`);
        res.redirect('/staff/dashboard');
    } catch (err) {
        console.error('Staff login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/staff-login');
    }
});

// =================== STUDENT REGISTRATION (FAST - NO IMAGE, NO EMAILS) ===================
router.get('/student-register', (req, res) => {
    res.render('auth/student-register', {
        title: 'Student Registration - Islamic School',
        page: 'student-register'
    });
});

router.post('/student-register', uploadPicture.single('profile_picture'), async (req, res) => {
    console.time('register-start');
    const {
        first_name, last_name, email, date_of_birth, gender, class_name, parent_name, parent_phone, address, password, confirm_password
    } = req.body || {};

    // Handle file upload error
    if (req.fileValidationError) {
        req.flash('error', req.fileValidationError.message);
        return res.redirect('/auth/student-register');
    }

    const full_name = `${first_name || ''} ${last_name || ''}`.trim();

    if (!first_name || !last_name || !email || !password || !confirm_password) {
        req.flash('error', 'Please fill in all required fields');
        return res.redirect('/auth/student-register');
    }

    if (password !== confirm_password) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/auth/student-register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters');
        return res.redirect('/auth/student-register');
    }

    try {
// FAST: Single query for email check + max admission_number
        // Simple original query
        const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (checks[0].email_exists) {
            req.flash('error', 'Email already registered');
            return res.redirect('/auth/student-register');
        }

        const count = checks[0].next_count || 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        // FAST: bcrypt first (parallel with other prep)
        const hashedPassword = await bcrypt.hash(password, 10);

        // SINGLE TRANSACTION: All inserts atomic + fast
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            const userRes = await client.query(
                'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [email, email, hashedPassword, 'student']
            );
            const user_id = userRes.rows[0].id;

            await client.query(
                `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, picture, class, parent_name, parent_phone, address)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [user_id, admission_number, first_name, last_name, email, date_of_birth || null, gender || null, req.file ? req.file.path : null, class_name || null, parent_name || null, parent_phone || null, address || null]
            );

            const studentRes = await client.query('SELECT id FROM students WHERE admission_number = $1', [admission_number]);
            const student_id = studentRes.rows[0].id;

            await client.query('COMMIT');
            
            // Session + redirect
            req.session.pendingRegistration = {
                student_id,
                admission_number,
                full_name,
                email,
                class_name: class_name || 'Not specified'
            };

            console.log(`✅ ULTRA-FAST Registration: ${admission_number} (${full_name})`);
            
        } finally {
            client.release();
        }

        console.timeEnd('register-start');
        res.redirect('/auth/registration-payment');
    } catch (err) {
        console.timeEnd('register-start');
        console.error('Registration error:', err);
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/student-register');
    }
});

// ... rest of routes unchanged (payment, forgot-password, etc.) ...

// Flutterwave payment callback (keep but comment emails for speed)
router.get('/payment-callback', async (req, res) => {
    const { status, tx_ref, transaction_id } = req.query;
    const pending = req.session.pendingRegistration;

    if (!pending) {
        req.flash('error', 'Session expired. Contact admin.');
        return res.redirect('/auth/student-login');
    }

    if (status === 'successful') {
        try {
            // Record payment (no email)
            await db.query(
                `INSERT INTO payments (student_id, tx_ref, flw_transaction_id, amount, currency, payment_type, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tx_ref) DO UPDATE SET status = $7`,
                [pending.student_id, tx_ref, transaction_id, 2000, 'NGN', 'registration', 'successful']
            );

            console.log(`✅ Payment: ${pending.admission_number}`);

            delete req.session.pendingRegistration;
            req.flash('success', `Payment OK! Admission: ${pending.admission_number}`);
            res.redirect('/auth/student-login');
        } catch (err) {
            console.error('Payment error:', err);
            delete req.session.pendingRegistration;
            res.redirect('/auth/student-login');
        }
    } else {
        req.flash('error', 'Payment failed. Try again.');
        res.redirect('/auth/registration-payment');
    }
});

// Forgot password, reset, logout (unchanged)
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
