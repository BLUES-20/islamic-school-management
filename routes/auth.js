// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/db');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =================== Gmail Email Setup ===================
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to send email using Gmail
async function sendEmail(to, subject, html) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('📧 Email skipped (EMAIL_USER or EMAIL_PASS not configured):', subject);
        return false;
    }
    try {
        await emailTransporter.sendMail({
            from: `Islamic School <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });
        console.log(`✅ Email sent to ${to}`);
        return true;
    } catch (err) {
        console.error('Email sending error:', err.message);
        return false;
    }
}

// Configure Multer for Student Picture Uploads
const pictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/students';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadPicture = multer({
    storage: pictureStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only JPG, JPEG and PNG images are allowed!'));
    }
});

// =================== STUDENT LOGIN ===================
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', {
        title: 'Student Login - Islamic School',
        page: 'student-login'
    });
});

router.post('/student-login', async (req, res) => {
    const { admission_number, password } = req.body;

    if (!admission_number || !password) {
        req.flash('error', 'Please enter admission number and password');
        return res.redirect('/auth/student-login');
    }

    try {
        const query = `
            SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class, s.picture
            FROM users u
            JOIN students s ON u.id = s.user_id
            WHERE s.admission_number = $1 AND u.role = 'student'
        `;
        const { rows } = await db.query(query, [admission_number]);

        if (!rows || rows.length === 0) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        const student = rows[0];
        
        // Check password (handle plain text for seed data, hashed for others)
        let match = false;
        if (student.password === password) {
            match = true;
        } else {
            match = await bcrypt.compare(password, student.password);
        }

        if (!match) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        req.session.student = {
            id: student.id,
            user_id: student.user_id,
            name: student.first_name + ' ' + student.last_name,
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
    res.render('auth/staff-login', {
        title: 'Staff Login - Islamic School',
        page: 'staff-login'
    });
});

router.post('/staff-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    try {
        const query = `
            SELECT u.id as user_id, u.password, u.role, u.email, s.id as staff_id, s.first_name, s.last_name, s.position
            FROM users u
            LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.email = $1 AND u.role IN ('staff', 'admin')
        `;
        const { rows } = await db.query(query, [email]);

        if (!rows || rows.length === 0) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        const user = rows[0];
        
        // Check password (handle plain text for seed admin, hashed for others)
        let match = false;
        if (user.password === password) {
            match = true;
        } else {
            match = await bcrypt.compare(password, user.password);
        }

        if (!match) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        req.session.staff = {
            id: user.staff_id || user.user_id,
            user_id: user.user_id,
            name: user.first_name ? (user.first_name + ' ' + user.last_name) : 'Administrator',
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

// =================== STUDENT REGISTRATION ===================
router.get('/student-register', (req, res) => {
    res.render('auth/student-register', {
        title: 'Student Registration - Islamic School',
        page: 'student-register'
    });
});

router.post('/student-register', uploadPicture.single('profile_picture'), async (req, res) => {
    const { 
        first_name,
        last_name, 
        email, 
        date_of_birth, 
        gender, 
        class_name, 
        parent_name, 
        parent_phone, 
        address, 
        password, 
        confirm_password 
    } = req.body;

    const full_name = `${first_name} ${last_name}`;

    // Validation
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
        // Check if email already exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            req.flash('error', 'Email already registered');
            return res.redirect('/auth/student-register');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate admission number
        const year = new Date().getFullYear();
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult.rows[0].count) + 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        // Create user first
        const userResult = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [email, email, hashedPassword, 'student']
        );
        const user_id = userResult.rows[0].id;

        // Handle profile picture
        let picturePath = null;
        if (req.file) {
            picturePath = '/uploads/students/' + req.file.filename;
        }

        // Create student record
        await db.query(
            `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, picture, class, parent_name, parent_phone, address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [user_id, admission_number, first_name, last_name, email, date_of_birth || null, gender || null, picturePath, class_name || null, parent_name || null, parent_phone || null, address || null]
        );

        // Send admission number to admin email
        const adminEmail = process.env.EMAIL_USER;
        const adminHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h2 style="margin: 0;">📋 New Student Registration</h2>
                    <p style="margin: 5px 0 0 0;">Islamic School Management System</p>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                    <h3>Student Details:</h3>
                    <p><strong>Full Name:</strong> ${full_name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Admission Number:</strong> <span style="font-size: 1.2em; color: #1a5f3f; font-weight: bold;">${admission_number}</span></p>
                    <p><strong>Class:</strong> ${class_name || 'Not specified'}</p>
                    <p><strong>Date of Birth:</strong> ${date_of_birth || 'Not specified'}</p>
                    <p><strong>Gender:</strong> ${gender || 'Not specified'}</p>
                    <p><strong>Parent Name:</strong> ${parent_name || 'Not specified'}</p>
                    <p><strong>Parent Phone:</strong> ${parent_phone || 'Not specified'}</p>
                    <p><strong>Address:</strong> ${address || 'Not specified'}</p>
                    <p style="margin-top: 20px; color: #666; font-size: 0.9em;">Registered on: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;
        await sendEmail(adminEmail, `New Student Registration - ${admission_number}`, adminHtml);

        // Send welcome email to the student
        const studentHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h2 style="margin: 0;">🎉 Welcome to Islamic School!</h2>
                    <p style="margin: 5px 0 0 0;">Registration Successful</p>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                    <p>Dear <strong>${full_name}</strong>,</p>
                    <p>Your registration has been completed successfully. Please save your admission number below — you will need it to log in.</p>
                    <div style="background-color: #1a5f3f; color: white; text-align: center; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 0.9em;">Your Admission Number</p>
                        <h1 style="margin: 10px 0; letter-spacing: 3px;">${admission_number}</h1>
                    </div>
                    <p>To login, visit your school portal and use your admission number and the password you created during registration.</p>
                    <p>JazakAllah Khair,<br><strong>Islamic School Management</strong></p>
                </div>
            </div>
        `;
        await sendEmail(email, `Your Admission Number - ${admission_number}`, studentHtml);

        req.flash('success', `Registration successful! Your admission number is: ${admission_number}. Please save it for login.`);
        res.redirect('/auth/student-login');

    } catch (err) {
        console.error('Registration error:', err);
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/student-register');
    }
});

// =================== FORGOT PASSWORD ===================
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password - Islamic School',
        page: 'forgot-password'
    });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            req.flash('error', 'No account with that email exists.');
            return res.redirect('/auth/forgot-password');
        }

        // Generate token
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await db.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
            [token, expires, email]
        );

        // ALWAYS use OS module to get the fresh local network IP address
        // Discard any stale IP from .env
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let localIp = null;
        
        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = `http://${net.address}:${process.env.PORT || 3000}`;
                    break;
                }
            }
            if (localIp) break;
        }
        
        // Fallback just in case
        const appUrl = localIp || `http://${req.headers.host}`;
        const resetLink = `${appUrl}/auth/reset-password/${token}`;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h2 style="margin: 0;">Islamic School Management System</h2>
                    <p style="margin: 5px 0 0 0;">Password Reset Request</p>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                    <p>Hello,</p>
                    <p>You have requested to reset your password. Click the button below to create a new password.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #1a5f3f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    <p>Or copy and paste this link: <a href="${resetLink}">${resetLink}</a></p>
                    <p><strong>⏰ This link expires in 1 hour.</strong></p>
                </div>
            </div>
        `;

        const sent = await sendEmail(email, 'Password Reset Request - Islamic School', emailHtml);
        
        if (sent) {
            req.flash('success', 'Password reset email sent to ' + email);
        } else {
            req.flash('error', 'Email service not available. Please contact admin.');
        }
        res.redirect('/auth/forgot-password');

    } catch (err) {
        console.error('Forgot password error:', err);
        req.flash('error', 'Error sending email. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        res.render('auth/reset-password', {
            title: 'Reset Password',
            page: 'reset-password',
            token: req.params.token
        });
    } catch (err) {
        console.error('Reset token check error:', err);
        res.redirect('/auth/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirm_password } = req.body;
        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('back');
        }

        const result = await db.query(
            'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, result.rows[0].id]
        );

        req.flash('success', 'Success! Your password has been changed.');
        res.redirect('/auth/student-login');

    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'Error resetting password.');
        res.redirect('back');
    }
});

// =================== LOGOUT ===================
router.get('/logout', (req, res) => {
    const isStaff = !!req.session.staff;
    req.session.destroy(err => {
        if (err) console.error('Logout error:', err);
        // Cannot use flash after session is destroyed, so we redirect with query param
        res.redirect(isStaff ? '/auth/staff-login?logout=1' : '/auth/student-login?logout=1');
    });
});

module.exports = router;
