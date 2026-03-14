const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to ensure staff is logged in
const ensureStaff = (req, res, next) => {
    if (req.session.staff) {
        return next();
    }
    req.flash('error', 'Please login as staff to access this page.');
    res.redirect('/auth/staff-login');
};

// Staff Dashboard
router.get('/dashboard', ensureStaff, (req, res) => {
    res.render('staff/dashboard', {
        title: 'Staff Dashboard',
        staff: req.session.staff,
        page: 'dashboard'
    });
});

// GET: Show Upload Result Form
router.get('/upload-result', ensureStaff, async (req, res) => {
    let uploadedSubjects = [];

    // If we have student details in query, fetch their existing results for this term
    if (req.query.admission_number && req.query.term && req.query.academic_year) {
        try {
            const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [req.query.admission_number]);
            if (studentRes.rows.length > 0) {
                const student_id = studentRes.rows[0].id;
                const subRes = await db.query(
                    'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY id DESC',
                    [student_id, req.query.term, req.query.academic_year]
                );
                uploadedSubjects = subRes.rows;
            }
        } catch (err) {
            console.error(err);
        }
    }

    res.render('staff/upload-result', {
        title: 'Upload Student Result',
        staff: req.session.staff,
        page: 'upload-result',
        query: req.query, // Pass query params to pre-fill form
        uploadedSubjects // Pass existing subjects to view
    });
});

// POST: Process Upload Result
router.post('/upload-result', ensureStaff, async (req, res) => {
    const {
        admission_number,
        class_name,
        subject,
        score,
        term,
        academic_year
    } = req.body;

    // Construct redirect URL to keep form filled
    const redirectUrl = `/staff/upload-result?admission_number=${encodeURIComponent(admission_number)}&class_name=${encodeURIComponent(class_name)}&term=${encodeURIComponent(term)}&academic_year=${encodeURIComponent(academic_year)}`;

    try {
        // 1. Find student by admission number
        const studentResult = await db.query('SELECT id FROM students WHERE admission_number = $1', [admission_number]);

        if (studentResult.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect(redirectUrl);
        }

        const student_id = studentResult.rows[0].id;

        // 2. Calculate grade automatically
        const numScore = parseFloat(score);

        // Server-side Validation
        if (isNaN(numScore) || numScore < 0 || numScore > 100) {
            req.flash('error', 'Score must be between 0 and 100');
            return res.redirect(redirectUrl);
        }

        let grade = 'F';
        if (numScore >= 70) grade = 'A';
        else if (numScore >= 60) grade = 'B';
        else if (numScore >= 50) grade = 'C';
        else if (numScore >= 45) grade = 'D';
        else if (numScore >= 40) grade = 'E';

        // 3. Insert or Update Result (UPSERT)
        // Normalize subject to ensure consistency
        const normalizedSubject = subject.trim().toUpperCase();

        await db.query(
            `
            INSERT INTO results (student_id, subject, score, grade, term, academic_year)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (student_id, subject, term, academic_year)
            DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade
            `,
            [student_id, normalizedSubject, numScore, grade, term, academic_year]
        );

        // 4. Calculate Total Score for this student/term
        const totalRes = await db.query(
            'SELECT SUM(score) as total FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3',
            [student_id, term, academic_year]
        );
        const total = totalRes.rows[0].total || numScore;

        req.flash('success', `Result uploaded! Grade: ${grade}. Total Score: ${total}`);
        res.redirect(redirectUrl);

    } catch (err) {
        console.error('Upload result error:', err);
        req.flash('error', 'Error uploading result. Please try again.');
        res.redirect(redirectUrl);
    }
});

module.exports = router;
