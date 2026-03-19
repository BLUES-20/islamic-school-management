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
        // Check if email already exists
        const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length) {
            req.flash('error', 'Email registered');
            return res.redirect('/auth/student-register');
        }

        const yearStr = new Date().getFullYear();
        const { rows: countResult } = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult[0].count) + 1;
        const admission_number = `STU${yearStr}${count.toString().padStart(3, '0')}`;

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

// =================== REGISTRATION PAYMENT PAGE ===================
router.get('/registration-payment', (req, res) => {
    const pending = req.session.pendingRegistration;
    if (!pending) {
        req.flash('error', 'No pending registration found. Please register first.');
        return res.redirect('/auth/student-register');
    }

    const amount = process.env.PAYMENT_AMOUNT || '2000';
    const currency = process.env.CURRENCY || 'NGN';
    const tx_ref = `REG-${pending.admission_number}-${Date.now()}`;

    // Store tx_ref in session so we can verify later
    req.session.pendingRegistration.tx_ref = tx_ref;

    res.render('auth/registration-payment', {
        title: 'Registration Payment - Islamic School',
        page: 'registration-payment',
        pending,
        amount,
        currency,
        tx_ref
    });
});

// Flutterwave payment callback - SEND ADMISSION NUMBER AFTER PAYMENT SUCCESS
router.get('/payment-callback', async (req, res) => {
    const { status, tx_ref, transaction_id } = req.query;
    let pending = req.session.pendingRegistration;

    console.log(`\n💳 ========== PAYMENT CALLBACK ==========`);
    console.log(`Status: ${status}`);
    console.log(`TX Ref: ${tx_ref}`);
    console.log(`Transaction ID: ${transaction_id}`);
    console.log(`Session pending: ${pending ? '✓' : '✗'}`);

    // If no session, try to find the student from tx_ref
    if (!pending && tx_ref) {
        try {
            // tx_ref format: REG-STU2026###-timestamp
            const admissionMatch = tx_ref.match(/STU\d+/);
            if (admissionMatch) {
                const admission_number = admissionMatch[0];
                console.log(`🔍 Looking up student by admission number: ${admission_number}`);
                
                const studentRes = await db.query(
                    'SELECT id, first_name, last_name, email, class FROM students WHERE admission_number = $1',
                    [admission_number]
                );
                
                if (studentRes.rows.length > 0) {
                    const student = studentRes.rows[0];
                    pending = {
                        student_id: student.id,
                        admission_number: admission_number,
                        full_name: `${student.first_name} ${student.last_name}`,
                        email: student.email,
                        class_name: student.class
                    };
                    console.log(`✅ Student found: ${pending.full_name}`);
                } else {
                    console.warn(`⚠️ Student not found with admission number: ${admission_number}`);
                }
            }
        } catch (lookupErr) {
            console.error('Error looking up student:', lookupErr);
        }
    }

    if (!pending) {
        console.error('❌ No pending registration or student found in session');
        req.flash('error', 'Session expired or student not found. Please contact admin.');
        return res.redirect('/auth/student-login');
    }

    if (status === 'successful') {
        try {
            console.log(`✅ Payment successful for student ${pending.student_id}`);
            
            // Record payment
            const paymentRes = await db.query(
                `INSERT INTO payments (student_id, tx_ref, flw_transaction_id, amount, currency, payment_type, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tx_ref) DO UPDATE SET status = $7
                 RETURNING id`,
                [pending.student_id, tx_ref, transaction_id, 2000, 'NGN', 'registration', 'successful']
            );
            console.log(`💾 Payment recorded:`, paymentRes.rows[0]);

            // Store success data in session for the success page
            req.session.paymentSuccess = {
                student: {
                    full_name: pending.full_name,
                    email: pending.email,
                    admission_number: pending.admission_number,
                    class_name: pending.class_name
                },
                adminEmail: process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@school.com'
            };

            delete req.session.pendingRegistration;
            
            // Build the email HTML
            const admissionHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">✅ Registration Complete</h2>
                        <p style="margin: 5px 0 0 0;">Islamic School Management System</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                        <p>Dear <strong>${pending.full_name}</strong>,</p>
                        <p>Congratulations! Your registration and payment have been processed successfully.</p>
                        <div style="background-color: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0; color: #155724;">Your Admission Number</p>
                            <h1 style="margin: 10px 0 0 0; color: #155724; font-size: 2.5em; font-family: 'Courier New', monospace;">${pending.admission_number}</h1>
                        </div>
                        <p><strong>Important:</strong> Please save your admission number. You will use it to login to your student portal.</p>
                        <p><strong>Class:</strong> ${pending.class_name}</p>
                        <p style="margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
                            You can now login at: <a href="https://islamic-school-management.onrender.com/auth/student-login" style="color: #1a5f3f; text-decoration: none;"><strong>Student Portal</strong></a>
                        </p>
                        <p>JazakAllah Khair,<br><strong>Islamic School Management</strong></p>
                    </div>
                </div>
            `;

            // Store success data in session FIRST
            req.session.paymentSuccess = {
                student: {
                    full_name: pending.full_name,
                    email: pending.email,
                    admission_number: pending.admission_number,
                    class_name: pending.class_name
                },
                adminEmail: process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@school.com'
            };
            
            console.log(`🎉 Payment recorded and session stored - sending email in background`);
            
            // SEND EMAIL IN BACKGROUND (non-blocking)
            // This doesn't block the redirect, but we'll log any failures
            (async () => {
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure DB is updated
                
                try {
                    console.log(`\n📧 ========== BACKGROUND EMAIL SEND ==========`);
                    console.log(`To: ${pending.email}`);
                    console.log(`Student: ${pending.full_name}`);
                    console.log(`Admission #: ${pending.admission_number}`);
                    console.log(`Time: ${new Date().toISOString()}`);
                    
                    const emailResult = await sendEmail(
                        pending.email,
                        `Your Admission Number - ${pending.admission_number}`,
                        admissionHtml
                    );
                    
                    if (emailResult === true) {
                        console.log(`✅ SUCCESS: Email sent successfully to ${pending.email}`);
                        console.log(`========== EMAIL SEND COMPLETE ==========\n`);
                    } else {
                        console.error(`❌ FAILED: Email service returned ${emailResult}`);
                        console.error(`- Check Render environment variables`);
                        console.error(`- EMAIL_USER: ${process.env.EMAIL_USER ? 'SET ✓' : 'MISSING ✗'}`);
                        console.error(`- EMAIL_PASS: ${process.env.EMAIL_PASS ? 'SET ✓' : 'MISSING ✗'}`);
                        console.error(`========== EMAIL SEND FAILED ==========\n`);
                    }
                } catch (emailErr) {
                    console.error(`\n❌ ========== EMAIL EXCEPTION ==========`);
                    console.error(`Error: ${emailErr.message}`);
                    console.error(`Stack: ${emailErr.stack}`);
                    console.error(`To: ${pending.email}`);
                    console.error(`========== EMAIL EXCEPTION END ==========\n`);
                }
            })();

            console.log(`🎉 Redirecting to payment-success page`);
            // Redirect IMMEDIATELY (email continues in background)
            res.redirect('/auth/payment-success');
        } catch (err) {
            console.error('❌ Payment callback error:', err);
            req.flash('error', 'Payment processing failed. Please contact admin.');
            delete req.session.pendingRegistration;
            res.redirect('/auth/student-login');
        }
    } else {
        console.warn(`⚠️ Payment status: ${status}`);
        req.flash('error', 'Payment was not successful. Please try again.');
        res.redirect('/auth/registration-payment');
    }
});

// =================== PAYMENT SUCCESS PAGE ===================
router.get('/payment-success', (req, res) => {
    const successData = req.session.paymentSuccess;
    
    if (!successData) {
        req.flash('error', 'Session expired. Please contact admin.');
        return res.redirect('/auth/student-login');
    }

    res.render('auth/payment-success', {
        title: 'Registration Successful - Islamic School',
        page: 'payment-success',
        student: successData.student,
        adminEmail: successData.adminEmail
    });

    // Clear the success data after rendering
    delete req.session.paymentSuccess;
});

// =================== EMAIL DIAGNOSTIC TEST (for troubleshooting) ===================
router.get('/test-email/:email', async (req, res) => {
    const testEmail = req.params.email;
    
    console.log(`\n📧 ========== EMAIL TEST ==========`);
    console.log(`Testing email to: ${testEmail}`);
    
    const testHtml = `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a5f3f;">✅ Email System Test</h2>
            <p>If you received this email, the email system is working correctly!</p>
            <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> Render Production</p>
        </div>
    `;
    
    try {
        console.log(`🔄 Calling sendEmail function...`);
        const result = await sendEmail(testEmail, '✅ Islamic School - Email System Test', testHtml);
        console.log(`📧 sendEmail result: ${result}`);
        
        res.json({
            success: result,
            message: result ? '✅ Email sent successfully!' : '⚠️ Email failed to send',
            testEmail,
            timestamp: new Date().toISOString(),
            config: {
                EMAIL_USER: process.env.EMAIL_USER ? '✓ configured' : '✗ missing',
                EMAIL_PASS: process.env.EMAIL_PASS ? '✓ configured' : '✗ missing',
                RESEND_API_KEY: process.env.RESEND_API_KEY ? '✓ configured' : '✗ missing',
                SMTP_HOST: process.env.SMTP_HOST ? '✓ configured' : '✗ missing'
            }
        });
    } catch (err) {
        console.error(`❌ Email test error:`, err);
        res.json({
            success: false,
            error: err.message,
            testEmail,
            config: {
                EMAIL_USER: process.env.EMAIL_USER ? '✓ configured' : '✗ missing',
                EMAIL_PASS: process.env.EMAIL_PASS ? '✓ configured' : '✗ missing',
                RESEND_API_KEY: process.env.RESEND_API_KEY ? '✓ configured' : '✗ missing',
                SMTP_HOST: process.env.SMTP_HOST ? '✓ configured' : '✗ missing'
            }
        });
    }
});

// Forgot password, reset, logout (unchanged)
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
