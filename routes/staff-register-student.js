const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { studentStorage } = require('../config/cloudinary');
const { createStudentByAdmin } = require('../services/admin-student-register');

// Middleware to check staff auth (reuse from staff.js)
const isAuthenticated = (req, res, next) => {
    if (req.session.staff) return next();
    req.flash('error', 'Admin login required');
    res.redirect('/auth/staff-login');
};

// Configure multer for picture upload
const uploadPicture = multer({
    storage: studentStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only JPG/PNG images (2MB max)'));
    }
});

// GET /staff/register-student - Show form
router.get('/register-student', isAuthenticated, (req, res) => {
    res.render('staff/register-student', {
        title: 'Register Student - Admin',
        page: 'register-student',
        staff: req.session.staff
    });
});

// POST /staff/register-student - Process form
router.post('/register-student', isAuthenticated, uploadPicture.single('profile_picture'), async (req, res) => {
    const formData = req.body;
    const picturePath = req.file ? req.file.path : null;
    const adminEmail = process.env.ADMIN_EMAIL || req.session.staff.email || process.env.EMAIL_USER;

    // Add picture if uploaded
    if (picturePath) {
        formData.picturePath = picturePath;
    }

    const result = await createStudentByAdmin(formData, adminEmail);

    if (result.success) {
        req.flash('success', `Student "${formData.first_name} ${formData.last_name}" created! Admission: ${result.admission_number}`);
        res.redirect('/staff/register-student');
    } else {
        req.flash('error', result.error || 'Registration failed');
        res.redirect('/staff/register-student');
    }
});

module.exports = router;
