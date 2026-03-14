// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Student Registration Page
router.get('/student-register', (req, res) => {
    res.render('auth/student-register', {
        title: 'Student Registration - Islamic School',
        page: 'student-register'
    });
});

// Handle Student Registration
router.post('/student-register', (req, res) => {
    const {
        admission_number,
        first_name,
        last_name,
        email,
        password,
        class: studentClass,
        date_of_birth,
        gender,
        parent_name,
        parent_phone,
        parent_email
    } = req.body;

    if (!email || !password || !first_name || !last_name) {
        req.flash('error', 'Please fill in all required fields');
        return res.redirect('/auth/student-register');
    }

    // First create user
    const query1 = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
    db.query(query1, [email, email, password, 'student'], (err, result) => {
        if (err) {
            console.error('Registration error:', err);
            req.flash('error', 'Email already registered');
            return res.redirect('/auth/student-register');
        }

        // Then create student record
        const user_id = result.insertId;
        const query2 = 'INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, class, parent_name, parent_phone, parent_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        db.query(query2, [user_id, admission_number || `STU${Date.now()}`, first_name, last_name, email, date_of_birth, gender, studentClass, parent_name, parent_phone, parent_email], (err) => {
            if (err) {
                console.error('Student record error:', err);
                req.flash('error', 'Registration failed');
                return res.redirect('/auth/student-register');
            }

            req.flash('success', 'Registration successful! Please login.');
            res.redirect('/auth/student-login');
        });
    });
});

// Student Login Page
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', {
        title: 'Student Login - Islamic School',
        page: 'student-login'
    });
});

// Handle Student Login
router.post('/student-login', (req, res) => {
    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/student-login');
    }

    const query = 'SELECT u.*, s.* FROM users u JOIN students s ON u.id = s.user_id WHERE u.email = ? AND u.password = ? AND u.role = "student"';

    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error('Login error:', err);
            req.flash('error', 'Login failed');
            return res.redirect('/auth/student-login');
        }

        if (results.length > 0) {
            req.session.student = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/student/dashboard');
        } else {
            req.flash('error', 'Invalid email or password');
            res.redirect('/auth/student-login');
        }
    });
});

// Staff Login Page
router.get('/staff-login', (req, res) => {
    res.render('auth/staff-login', {
        title: 'Staff Login - Islamic School',
        page: 'staff-login'
    });
});

// Handle Staff Login
router.post('/staff-login', (req, res) => {
    const {
        email,
        password
    } = req.body;

    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    const query = 'SELECT u.*, s.* FROM users u JOIN staff s ON u.id = s.user_id WHERE u.email = ? AND u.password = ? AND u.role = "staff"';

    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error('Login error:', err);
            req.flash('error', 'Login failed');
            return res.redirect('/auth/staff-login');
        }

        if (results.length > 0) {
            req.session.staff = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/staff/dashboard');
        } else {
            req.flash('error', 'Invalid email or password');
            res.redirect('/auth/staff-login');
        }
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.student = null;
    req.session.staff = null;
    req.flash('success', 'Logged out successfully');
    res.redirect('/');
});

module.exports = router;
