// routes/student.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to check if student is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.student) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/auth/student-login');
};

// Apply authentication middleware to all student routes
router.use(isAuthenticated);

// Student Dashboard
router.get('/dashboard', (req, res) => {
    res.render('student/dashboard', { 
        title: 'Student Dashboard - Islamic School',
        page: 'student-dashboard',
        student: req.session.student
    });
});

// Check Result Page
router.get('/check-result', async (req, res) => {
    let results = [];
    const { term, academic_year } = req.query;

    if (term && academic_year) {
        try {
            const query = `
                SELECT subject, score, grade 
                FROM results 
                WHERE student_id = $1 AND term = $2 AND academic_year = $3
            `;
            const { rows } = await db.query(query, [req.session.student.id, term, academic_year]);
            results = rows;
            
            if (results.length === 0) {
                 req.flash('error', `No results found for ${term} ${academic_year}. Please check the term/year selected.`);
            }
        } catch (err) {
            console.error('Error fetching results:', err);
            req.flash('error', 'Error fetching results');
        }
    }

    res.render('student/check-result', { 
        title: 'Check Result - Islamic School',
        page: 'check-result',
        student: req.session.student,
        results,
        term,
        academic_year
    });
});

router.post('/check-result', (req, res) => {
    const { term, academic_year } = req.body;
    res.redirect(`/student/check-result?term=${encodeURIComponent(term)}&academic_year=${encodeURIComponent(academic_year)}`);
});

// Announcements Page
router.get('/announcements', (req, res) => {
    res.render('student/announcements', { 
        title: 'Announcements - Islamic School',
        page: 'announcements',
        student: req.session.student
    });
});

// Profile Page - Fetch student data including picture
router.get('/profile', async (req, res) => {
    try {
        // Fetch student details including picture from database
        const query = `
            SELECT s.id, s.admission_number, s.first_name, s.last_name, s.email,
                   s.class, s.date_of_birth, s.gender, s.picture, s.parent_name,
                   s.parent_phone, s.parent_email, s.address
            FROM students s
            WHERE s.id = $1
        `;
        const { rows } = await db.query(query, [req.session.student.id]);
        
        if (rows.length === 0) {
            req.flash('error', 'Student record not found');
            return res.redirect('/student/dashboard');
        }
        
        const studentData = rows[0];
        
        res.render('student/profile', {
            title: 'My Profile - Islamic School',
            page: 'profile',
            student: req.session.student,
            studentData: studentData
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        req.flash('error', 'Error loading profile');
        res.redirect('/student/dashboard');
    }
});

// Generate PDF Result
router.get('/download-result/:term/:academic_year', async (req, res) => {
    const { term, academic_year } = req.params;

    try {
        const query = `
            SELECT subject, score, grade
            FROM results
            WHERE student_id = $1 AND term = $2 AND academic_year = $3
            ORDER BY subject
        `;
        const { rows: results } = await db.query(query, [req.session.student.id, term, academic_year]);

        if (results.length === 0) {
            req.flash('error', 'No results found for the selected term and year.');
            return res.redirect('/student/check-result');
        }

        const totalScore = results.reduce((sum, result) => sum + parseFloat(result.score), 0);
        const averageScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : '0.00';

        // Generate PDF using PDFKit with enhanced styling
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true
        });

        // Collect PDF buffer
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfBuffer = Buffer.concat(buffers);
            const filename = `Academic_Result_${req.session.student.name.split(' ').join('_')}_${term.replace(' ', '_')}_${academic_year.replace('/', '_')}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
        });

        // --- NEW PROFESSIONAL STYLE ---

        // 1. Header Section
        doc.fillColor('#1a5f3f') // Islamic Green Theme
           .fontSize(22)
           .font('Helvetica-Bold')
           .text('ISLAMIC SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
           
        doc.fontSize(10)
           .font('Helvetica')
           .text('Excellence in Education & Morals', { align: 'center' });
           
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#1a5f3f').lineWidth(2).stroke();
        doc.moveDown(1.5);

        // 2. Student Information (Grid Layout)
        const startY = doc.y;
        
        // Left Column
        doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Name:', 50, startY);
        doc.font('Helvetica').text(req.session.student.name, 130, startY);
        
        doc.font('Helvetica-Bold').text('Admission No:', 50, startY + 20);
        doc.font('Helvetica').text(req.session.student.admission_number, 130, startY + 20);
        
        // Right Column
        doc.font('Helvetica-Bold').text('Class:', 350, startY);
        doc.font('Helvetica').text(req.session.student.class || 'N/A', 420, startY);
        
        doc.font('Helvetica-Bold').text('Term:', 350, startY + 20);
        doc.font('Helvetica').text(term, 420, startY + 20);
        
        doc.font('Helvetica-Bold').text('Session:', 350, startY + 40);
        doc.font('Helvetica').text(academic_year, 420, startY + 40);

        doc.moveDown(4);

        // 3. Results Table
        const tableTop = doc.y;
        const itemHeight = 25;
        
        // Header Row
        doc.rect(50, tableTop, 500, itemHeight).fill('#1a5f3f');
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('SUBJECT', 60, tableTop + 8);
        doc.text('SCORE', 300, tableTop + 8, { width: 50, align: 'center' });
        doc.text('GRADE', 380, tableTop + 8, { width: 50, align: 'center' });
        doc.text('REMARK', 460, tableTop + 8, { width: 80, align: 'center' });

        let currentY = tableTop + itemHeight;
        
        // Data Rows
        doc.font('Helvetica').fontSize(10);
        
        results.forEach((result, i) => {
            // Zebra Striping
            if (i % 2 === 0) {
                doc.rect(50, currentY, 500, itemHeight).fill('#f9f9f9');
            }
            
            // Determine Remark
            let remark = 'Fail';
            if (result.grade === 'A') remark = 'Excellent';
            else if (result.grade === 'B') remark = 'Very Good';
            else if (result.grade === 'C') remark = 'Good';
            else if (result.grade === 'D') remark = 'Fair';
            else if (result.grade === 'E') remark = 'Pass';
            
            doc.fillColor('#000000');
            doc.text(result.subject, 60, currentY + 8);
            doc.text(result.score, 300, currentY + 8, { width: 50, align: 'center' });
            
            // Colorize Grade
            if (result.grade === 'F') doc.fillColor('#dc3545'); // Red
            else if (result.grade === 'A') doc.fillColor('#198754'); // Green
            else doc.fillColor('#000000');
            
            doc.text(result.grade, 380, currentY + 8, { width: 50, align: 'center' });
            
            doc.fillColor('#000000');
            doc.text(remark, 460, currentY + 8, { width: 80, align: 'center' });
            
            currentY += itemHeight;
        });
        
        // Bottom Line
        doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#aaaaaa').lineWidth(1).stroke();
        
        // 4. Summary Section (Aggregate & Average)
        const summaryY = currentY + 30;
        
        // Summary Box
        doc.rect(350, summaryY, 200, 80).strokeColor('#1a5f3f').lineWidth(1).stroke();
        doc.rect(350, summaryY, 200, 25).fill('#1a5f3f');
        
        doc.fillColor('#ffffff').font('Helvetica-Bold').text('PERFORMANCE SUMMARY', 350, summaryY + 8, { width: 200, align: 'center' });
        
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        
        // Aggregate Score
        doc.text('Aggregate Score:', 360, summaryY + 35);
        doc.font('Helvetica-Bold').text(totalScore.toFixed(2), 480, summaryY + 35, { align: 'right', width: 60 });
        
        // Average Score
        doc.font('Helvetica').text('Average Score:', 360, summaryY + 55);
        doc.font('Helvetica-Bold').text(averageScore + '%', 480, summaryY + 55, { align: 'right', width: 60 });

        // 5. Footer / Signatures
        const footerY = doc.page.height - 120;
        
        // Add Signature Image (if exists) - Centered and "signed" on the line
        try {
            const path = require('path');
            const sigPath = path.join(__dirname, '../public/images/principal-signature.png');
            // Positioned to slightly overlap the line for a real signed look
            doc.image(sigPath, 60, footerY - 50, { width: 130 }); 
        } catch (e) {
            console.log('Signature image not found, skipping...');
        }
        
        doc.moveTo(50, footerY).lineTo(200, footerY).strokeColor('#000000').lineWidth(1).stroke();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('Principal\'s Signature', 50, footerY + 10, { width: 150, align: 'center' });
        
        // Automatic Date - Arranged to the right margin with premium styling
        const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f3f').text(currentDate, 350, footerY - 18, { width: 150, align: 'center' });
        
        doc.moveTo(350, footerY).lineTo(500, footerY).strokeColor('#000000').stroke();
        doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Date Issued', 350, footerY + 10, { width: 150, align: 'center' });
        
        // Disclaimer - Well arranged at the bottom
        doc.fontSize(8).fillColor('#999999').text('This academic report is computer generated and officially validated by the school administration.', 50, doc.page.height - 40, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF generation error:', err);
        req.flash('error', 'Error generating PDF. Please try again.');
        res.redirect('/student/check-result');
    }
});

module.exports = router;

