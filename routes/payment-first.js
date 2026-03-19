const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const https = require('https');
const router = express.Router();
const db = require('../config/db');
const { sendPaymentReceipt } = require('../services/payment-receipt-updated');
const { studentStorage } = require('../config/cloudinary');
const multer = require('multer');
const path = require('path');
const uploadPicture = multer({ storage: studentStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// Configure multer for picture
const pictureFilter = (req, file, cb) => {
    const allowedTypes = /jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only JPG, PNG images allowed'));
};
uploadPicture.fileFilter = pictureFilter;

// === STEP 1: Collect registration form + start payment (NO student created yet) ===
router.get('/pay-first-register', (req, res) => {
    res.render('auth/pay-first-register', {
        title: 'Pay First Registration - Islamic School',
        page: 'pay-first-register'
    });
});

router.post('/pay-first-register', uploadPicture.single('profile_picture'), (req, res) => {
    const formData = req.body;
    const picturePath = req.file ? req.file.path : null;

    // Basic validation
    const required = ['first_name', 'last_name', 'email', 'password'];
    const missing = required.filter(field => !formData[field]);
    if (missing.length > 0) {
        req.flash('error', 'Please fill all required fields');
        return res.redirect('/auth/pay-first-register');
    }
    if (formData.password.length < 6) {
        req.flash('error', 'Password must be 6+ characters');
        return res.redirect('/auth/pay-first-register');
    }

    // Store ALL data in session (no DB yet)
    const tx_ref = `REG-${crypto.randomBytes(8).toString('hex')}-${Date.now()}`;
    req.session.pendingPaymentData = {
        ...formData,
        picturePath,
        tx_ref,
        payment_initiated: new Date().toISOString()
    };

    // Redirect to payment
res.redirect(`/auth/pay-first-payment?tx_ref=${tx_ref}`);
});

// === STEP 2: Flutterwave Payment Page ===
router.get('/pay-first-payment', (req, res) => {
    const data = req.session.pendingPaymentData;
    if (!data) {
        req.flash('error', 'Session expired. Start over.');
        return res.redirect('/auth/pay-first-register');
    }

    const amount = process.env.PAYMENT_AMOUNT || '2000';
    const currency = process.env.CURRENCY || 'NGN';

    res.render('auth/pay-first-payment', {
        title: 'Complete Registration Payment',
        data,
        amount,
        currency,
        tx_ref: data.tx_ref
    });
});

// === STEP 3: Flutterwave Callback - CREATE STUDENT ONLY AFTER SUCCESS ===
router.get('/pay-first-callback', async (req, res) => {
    const { status, tx_ref, transaction_id } = req.query;
    const formData = req.session.pendingPaymentData;

    if (!formData || formData.tx_ref !== tx_ref) {
        req.flash('error', 'Invalid session.');
        return res.redirect('/auth/pay-first-register');
    }

    if (status !== 'successful' && status !== 'completed') {
        req.flash('error', 'Payment failed/cancelled.');
        delete req.session.pendingPaymentData;
        return res.redirect('/auth/pay-first-register');
    }

    try {
        // 1️⃣ VERIFY PAYMENT
        const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        let verified = false;
        if (flwSecretKey && transaction_id) {
            verified = await verifyFlutterwavePayment(transaction_id, flwSecretKey);
        }
        if (!verified) {
            req.flash('error', 'Payment verification failed.');
            return res.redirect('/auth/student-login');
        }

        // 2️⃣ CREATE STUDENT (NOW SAFE - payment verified)
        const year = new Date().getFullYear();
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult.rows[0].count) + 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        const hashedPassword = await bcrypt.hash(formData.password, 10);

        // Create user
        const userResult = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [formData.email, formData.email, hashedPassword, 'student']
        );
        const user_id = userResult.rows[0].id;

        // Create student
        await db.query(
            `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, picture, class, parent_name, parent_phone, address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [user_id, admission_number, formData.first_name, formData.last_name, formData.email,
             formData.date_of_birth || null, formData.gender || null, formData.picturePath, 
             formData.class_name || null, formData.parent_name || null, formData.parent_phone || null, formData.address || null]
        );

        // 3️⃣ RECORD PAYMENT
        await db.query(
            `INSERT INTO payments (student_id, tx_ref, flw_transaction_id, amount, currency, payment_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [(await db.query('SELECT id FROM students WHERE admission_number = $1', [admission_number])).rows[0].id,
             tx_ref, transaction_id, process.env.PAYMENT_AMOUNT || 2000, process.env.CURRENCY || 'NGN', 'registration', 'successful']
        );

        // 4️⃣ SEND RECEIPT
        const studentDetails = {
            full_name: `${formData.first_name} ${formData.last_name}`,
            admission_number,
            class_name: formData.class_name
        };
        const paymentDetails = {
            amount: parseFloat(process.env.PAYMENT_AMOUNT || 2000),
            currency: process.env.CURRENCY || 'NGN',
            tx_ref,
            flw_transaction_id: transaction_id
        };
        await sendPaymentReceipt(formData.email, studentDetails, paymentDetails);

        // 5️⃣ CLEANUP + SUCCESS
        delete req.session.pendingPaymentData;
        req.flash('success', `Registration SUCCESSFUL! Admission: ${admission_number}. Check your email for RECEIPT.`);
        res.redirect('/auth/student-login');

    } catch (err) {
        console.error('Pay-first error:', err);
        req.flash('error', 'Registration failed after payment. Contact admin.');
        res.redirect('/auth/student-login');
    }
});

// Flutterwave verify helper (same as original)
function verifyFlutterwavePayment(transactionId, secretKey) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.flutterwave.com',
            port: 443,
            path: `/v3/transactions/${transactionId}/verify`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const expectedAmount = parseFloat(process.env.PAYMENT_AMOUNT || 2000);
                    resolve(result.status === 'success' && result.data?.status === 'successful' && 
                           result.data.amount >= expectedAmount && result.data.currency === (process.env.CURRENCY || 'NGN'));
                } catch (e) { resolve(false); }
            });
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

module.exports = router;
