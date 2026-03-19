// routes/student.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const { studentStorage } = require('../config/cloudinary');

// Configure multer for profile picture uploads via Cloudinary
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

// =================== UPLOAD PROFILE PICTURE ===================
router.post('/profile/upload-picture', uploadPicture.single('profile_picture'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Please select an image to upload');
            return res.redirect('/student/profile');
        }

        // Cloudinary returns the URL in req.file.path
        const picturePath = req.file.path;

        // Update the database
        await db.query('UPDATE students SET picture = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [picturePath, req.session.student.id]);

        // Update the session so the navbar/profile shows the new picture immediately
        req.session.student.picture = picturePath;

        req.flash('success', 'Profile picture updated successfully!');
        res.redirect('/student/profile');
    } catch (err) {
        console.error('Profile picture upload error:', err);
        req.flash('error', 'Failed to upload profile picture. Please try again.');
        res.redirect('/student/profile');
    }
});

// =================== DOWNLOAD PROFILE PDF ===================
router.get('/profile/download-pdf', async (req, res) => {
    try {
        // Fetch full student data
        const query = `
            SELECT s.id, s.admission_number, s.first_name, s.last_name, s.email,
                   s.class, s.date_of_birth, s.gender, s.picture, s.parent_name,
                   s.parent_phone, s.parent_email, s.address, s.created_at
            FROM students s
            WHERE s.id = $1
        `;
        const { rows } = await db.query(query, [req.session.student.id]);

        if (rows.length === 0) {
            req.flash('error', 'Student record not found');
            return res.redirect('/student/profile');
        }

        const s = rows[0];
        const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Student';
        const dobText = s.date_of_birth
            ? new Date(s.date_of_birth).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            : 'N/A';
        const enrollDate = s.created_at
            ? new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            : 'N/A';

        // Check payment status
        let paymentStatus = 'Not Paid';
        try {
            const paymentResult = await db.query(
                'SELECT status FROM payments WHERE student_id = $1 AND payment_type = $2 ORDER BY created_at DESC LIMIT 1',
                [s.id, 'registration']
            );
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].status === 'successful') {
                paymentStatus = 'Paid';
            }
        } catch (e) { /* payments table may not exist yet */ }

        // Generate PDF
        const PDFDocument = require('pdfkit');
        const https = require('https');
        const http = require('http');

        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            const filename = `Student_Profile_${fullName.replace(/\s+/g, '_')}_${s.admission_number}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
        });

        // Helper to download image as buffer (for Cloudinary URLs)
        function downloadImage(url) {
            return new Promise((resolve) => {
                const client = url.startsWith('https') ? https : http;
                client.get(url, (response) => {
                    const chunks = [];
                    response.on('data', (chunk) => chunks.push(chunk));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                    response.on('error', () => resolve(null));
                }).on('error', () => resolve(null));
            });
        }

        // Build PDF content
        async function buildPDF() {
            const pageWidth = doc.page.width - 100;

            // ============ HEADER BANNER ============
            doc.rect(0, 0, doc.page.width, 120).fill('#1a5f3f');

            doc.fillColor('#ffffff')
                .fontSize(24)
                .font('Helvetica-Bold')
                .text('ISLAMIC SCHOOL', 50, 30, { align: 'center' });
            doc.fontSize(11)
                .font('Helvetica')
                .text('MANAGEMENT SYSTEM', { align: 'center' });
            doc.fontSize(9)
                .fillColor('#b8d4c8')
                .text('Excellence in Education & Morals', { align: 'center' });

            doc.moveTo(50, 110).lineTo(doc.page.width - 50, 110)
                .strokeColor('#ffffff').lineWidth(1).stroke();

            // ============ TITLE ============
            const titleY = 140;
            doc.rect(50, titleY, pageWidth, 35).fill('#f0f9f4');
            doc.fillColor('#1a5f3f')
                .fontSize(14)
                .font('Helvetica-Bold')
                .text('STUDENT INFORMATION CARD', 50, titleY + 10, { align: 'center', width: pageWidth });

            // ============ PROFILE PICTURE ============
            const pictureX = 420;
            const pictureY = 195;
            const picSize = 100;

            if (s.picture) {
                try {
                    const imgBuffer = await downloadImage(s.picture);
                    if (imgBuffer && imgBuffer.length > 100) {
                        doc.rect(pictureX - 3, pictureY - 3, picSize + 6, picSize + 6)
                            .strokeColor('#1a5f3f').lineWidth(2).stroke();
                        doc.image(imgBuffer, pictureX, pictureY, {
                            width: picSize, height: picSize, fit: [picSize, picSize]
                        });
                    } else {
                        drawPlaceholder();
                    }
                } catch (e) {
                    drawPlaceholder();
                }
            } else {
                drawPlaceholder();
            }

            function drawPlaceholder() {
                doc.rect(pictureX, pictureY, picSize, picSize)
                    .strokeColor('#cccccc').lineWidth(1).stroke();
                doc.fillColor('#999999').fontSize(9)
                    .text('No Photo', pictureX, pictureY + 42, { width: picSize, align: 'center' });
            }

            // ============ PERSONAL INFORMATION ============
            let infoY = 195;
            const labelX = 60;
            const valueX = 190;
            const lineH = 22;

            function addField(label, value, y) {
                doc.fillColor('#666666').fontSize(10).font('Helvetica-Bold').text(label, labelX, y);
                doc.fillColor('#000000').fontSize(10).font('Helvetica').text(value || 'N/A', valueX, y);
            }

            doc.fillColor('#1a5f3f').fontSize(12).font('Helvetica-Bold')
                .text('Personal Details', labelX, infoY);
            doc.moveTo(labelX, infoY + 16).lineTo(380, infoY + 16)
                .strokeColor('#1a5f3f').lineWidth(1).stroke();
            infoY += 25;

            addField('Full Name:', fullName, infoY); infoY += lineH;
            addField('Admission No:', s.admission_number, infoY); infoY += lineH;
            addField('Email:', s.email || 'N/A', infoY); infoY += lineH;
            addField('Class:', s.class || 'N/A', infoY); infoY += lineH;
            addField('Date of Birth:', dobText, infoY); infoY += lineH;
            addField('Gender:', s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : 'N/A', infoY);
            infoY += lineH;

            // ============ PARENT/GUARDIAN ============
            infoY += 15;
            doc.fillColor('#1a5f3f').fontSize(12).font('Helvetica-Bold')
                .text('Parent/Guardian Information', labelX, infoY);
            doc.moveTo(labelX, infoY + 16).lineTo(pageWidth + 50, infoY + 16)
                .strokeColor('#1a5f3f').lineWidth(1).stroke();
            infoY += 25;

            addField('Guardian Name:', s.parent_name || 'N/A', infoY); infoY += lineH;
            addField('Guardian Phone:', s.parent_phone || 'N/A', infoY); infoY += lineH;
            addField('Guardian Email:', s.parent_email || 'N/A', infoY); infoY += lineH;
            addField('Address:', s.address || 'N/A', infoY); infoY += lineH;

            // ============ ENROLLMENT INFO ============
            infoY += 15;
            doc.fillColor('#1a5f3f').fontSize(12).font('Helvetica-Bold')
                .text('Enrollment Information', labelX, infoY);
            doc.moveTo(labelX, infoY + 16).lineTo(pageWidth + 50, infoY + 16)
                .strokeColor('#1a5f3f').lineWidth(1).stroke();
            infoY += 25;

            addField('Enrollment Date:', enrollDate, infoY); infoY += lineH;
            addField('Payment Status:', paymentStatus, infoY);
            if (paymentStatus === 'Paid') {
                doc.fillColor('#198754').fontSize(10).font('Helvetica-Bold')
                    .text('✓ ' + paymentStatus, valueX, infoY);
            }
            infoY += lineH;

            // ============ SIGNATURES ============
            const stampY = doc.page.height - 150;

            doc.moveTo(60, stampY + 30).lineTo(210, stampY + 30)
                .strokeColor('#000000').lineWidth(1).stroke();
            doc.fillColor('#333333').fontSize(9).font('Helvetica-Bold')
                .text("Principal's Signature", 60, stampY + 35, { width: 150, align: 'center' });

            const printDate = new Date().toLocaleDateString('en-GB', {
                day: '2-digit', month: 'long', year: 'numeric'
            });
            doc.fillColor('#1a5f3f').fontSize(11).font('Helvetica-Bold')
                .text(printDate, 380, stampY + 12, { width: 150, align: 'center' });
            doc.moveTo(380, stampY + 30).lineTo(530, stampY + 30)
                .strokeColor('#000000').lineWidth(1).stroke();
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text('Date Printed', 380, stampY + 35, { width: 150, align: 'center' });

            // ============ FOOTER ============
            doc.fillColor('#999999').fontSize(8).font('Helvetica')
                .text('This document is computer generated by Islamic School Management System.',
                    50, doc.page.height - 50, { align: 'center', width: pageWidth });

            doc.end();
        }

        await buildPDF();

    } catch (err) {
        console.error('Profile PDF generation error:', err);
        req.flash('error', 'Error generating PDF. Please try again.');
        res.redirect('/student/profile');
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

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfBuffer = Buffer.concat(buffers);
            const filename = `Academic_Result_${req.session.student.name.split(' ').join('_')}_${term.replace(' ', '_')}_${academic_year.replace('/', '_')}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(pdfBuffer);
        });

        // Header
        doc.fillColor('#1a5f3f').fontSize(22).font('Helvetica-Bold')
            .text('ISLAMIC SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
            .text('Excellence in Education & Morals', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#1a5f3f').lineWidth(2).stroke();
        doc.moveDown(1.5);

        // Student Info Grid
        const startY = doc.y;
        doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text('Name:', 50, startY);
        doc.font('Helvetica').text(req.session.student.name, 130, startY);
        doc.font('Helvetica-Bold').text('Admission No:', 50, startY + 20);
        doc.font('Helvetica').text(req.session.student.admission_number, 130, startY + 20);
        doc.font('Helvetica-Bold').text('Class:', 350, startY);
        doc.font('Helvetica').text(req.session.student.class || 'N/A', 420, startY);
        doc.font('Helvetica-Bold').text('Term:', 350, startY + 20);
        doc.font('Helvetica').text(term, 420, startY + 20);
        doc.font('Helvetica-Bold').text('Session:', 350, startY + 40);
        doc.font('Helvetica').text(academic_year, 420, startY + 40);
        doc.moveDown(4);

        // Results Table
        const tableTop = doc.y;
        const itemHeight = 25;

        doc.rect(50, tableTop, 500, itemHeight).fill('#1a5f3f');
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('SUBJECT', 60, tableTop + 8);
        doc.text('SCORE', 300, tableTop + 8, { width: 50, align: 'center' });
        doc.text('GRADE', 380, tableTop + 8, { width: 50, align: 'center' });
        doc.text('REMARK', 460, tableTop + 8, { width: 80, align: 'center' });

        let currentY = tableTop + itemHeight;
        doc.font('Helvetica').fontSize(10);

        results.forEach((result, i) => {
            if (i % 2 === 0) {
                doc.rect(50, currentY, 500, itemHeight).fill('#f9f9f9');
            }

            let remark = 'Fail';
            if (result.grade === 'A') remark = 'Excellent';
            else if (result.grade === 'B') remark = 'Very Good';
            else if (result.grade === 'C') remark = 'Good';
            else if (result.grade === 'D') remark = 'Fair';
            else if (result.grade === 'E') remark = 'Pass';

            doc.fillColor('#000000');
            doc.text(result.subject, 60, currentY + 8);
            doc.text(result.score, 300, currentY + 8, { width: 50, align: 'center' });

            if (result.grade === 'F') doc.fillColor('#dc3545');
            else if (result.grade === 'A') doc.fillColor('#198754');
            else doc.fillColor('#000000');

            doc.text(result.grade, 380, currentY + 8, { width: 50, align: 'center' });
            doc.fillColor('#000000');
            doc.text(remark, 460, currentY + 8, { width: 80, align: 'center' });
            currentY += itemHeight;
        });

        doc.moveTo(50, currentY).lineTo(550, currentY).strokeColor('#aaaaaa').lineWidth(1).stroke();

        // Summary Box
        const summaryY = currentY + 30;
        doc.rect(350, summaryY, 200, 80).strokeColor('#1a5f3f').lineWidth(1).stroke();
        doc.rect(350, summaryY, 200, 25).fill('#1a5f3f');
        doc.fillColor('#ffffff').font('Helvetica-Bold')
            .text('PERFORMANCE SUMMARY', 350, summaryY + 8, { width: 200, align: 'center' });
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        doc.text('Aggregate Score:', 360, summaryY + 35);
        doc.font('Helvetica-Bold').text(totalScore.toFixed(2), 480, summaryY + 35, { align: 'right', width: 60 });
        doc.font('Helvetica').text('Average Score:', 360, summaryY + 55);
        doc.font('Helvetica-Bold').text(averageScore + '%', 480, summaryY + 55, { align: 'right', width: 60 });

        // Footer
        const footerY = doc.page.height - 120;
        try {
            const sigPath = path.join(__dirname, '../public/images/principal-signature.png');
            doc.image(sigPath, 60, footerY - 50, { width: 130 });
        } catch (e) { }

        doc.moveTo(50, footerY).lineTo(200, footerY).strokeColor('#000000').lineWidth(1).stroke();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
            .text("Principal's Signature", 50, footerY + 10, { width: 150, align: 'center' });

        const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a5f3f')
            .text(currentDate, 350, footerY - 18, { width: 150, align: 'center' });
        doc.moveTo(350, footerY).lineTo(500, footerY).strokeColor('#000000').stroke();
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
            .text('Date Issued', 350, footerY + 10, { width: 150, align: 'center' });

        doc.fontSize(8).fillColor('#999999')
            .text('This academic report is computer generated and officially validated by the school administration.',
                50, doc.page.height - 40, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF generation error:', err);
        req.flash('error', 'Error generating PDF. Please try again.');
        res.redirect('/student/check-result');
    }
});

module.exports = router;
