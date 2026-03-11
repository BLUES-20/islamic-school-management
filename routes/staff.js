// routes/staff.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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

const uploadStudentPicture = multer({
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

// Configure Multer for Document Uploads
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/documents';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadDocument = multer({
    storage: documentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|txt|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype;
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('Only PDF, DOC, DOCX, TXT, JPG, JPEG and PNG files are allowed!'));
    }
});

// Middleware to check if staff is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.staff) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/auth/staff-login');
};

// Apply authentication middleware to all staff routes
router.use(isAuthenticated);

// Staff Root Route - Redirect to Dashboard
router.get('/', (req, res) => {
    res.redirect('/staff/dashboard');
});

// Staff Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch total registered students count
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const studentCount = countResult.rows[0].count;

        // Fetch unread messages count
        const unreadMsgRes = await db.query("SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'");
        const unreadMessagesCount = unreadMsgRes.rows[0].count;

        res.render('staff/dashboard', {
            title: 'Staff Dashboard - Islamic School',
            page: 'staff-dashboard',
            staff: req.session.staff,
            studentCount,
            unreadMessagesCount
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        req.flash('error', 'Error loading dashboard data');
        res.redirect('/auth/staff-login');
    }
});

// Upload Document Page
// Upload Document Page
router.get('/upload-document', async (req, res) => {
    try {
        const docsRes = await db.query(
            `SELECT d.*, u.username as author_name 
             FROM documents d 
             LEFT JOIN users u ON d.author_id = u.id 
             ORDER BY d.uploaded_at DESC 
             LIMIT 10`
        );
        
        res.render('staff/upload-document', {
            title: 'Upload Document - Islamic School',
            page: 'upload-document',
            staff: req.session.staff,
            documents: docsRes.rows
        });
    } catch (err) {
        console.error('Error loading documents:', err);
        req.flash('error', 'Error loading documents list');
        res.redirect('/staff/dashboard');
    }
});

// Process Document Upload
router.post('/upload-document', uploadDocument.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Please select a file to upload');
            return res.redirect('/staff/upload-document');
        }

        const { title, description, document_type, target_audience } = req.body;
        const author_id = req.session.staff.user_id;
        const file_path = `/uploads/${req.file.filename}`;
        const file_name = req.file.originalname;
        const file_size = req.file.size;

        await db.query(
            `INSERT INTO documents (title, description, document_type, file_path, file_name, file_size, target_audience, author_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [title, description || null, document_type, file_path, file_name, file_size, target_audience || 'all', author_id]
        );

        req.flash('success', 'Document uploaded successfully');
        res.redirect('/staff/upload-document');
    } catch (err) {
        console.error('Document upload error:', err);
        req.flash('error', 'Error uploading document: ' + err.message);
        res.redirect('/staff/upload-document');
    }
});

// Delete Document
router.post('/delete-document/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get file path first to delete the physical file
        const docRes = await db.query('SELECT file_path FROM documents WHERE id = $1', [id]);
        if (docRes.rows.length > 0) {
            const filePath = path.join(__dirname, '../public', docRes.rows[0].file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await db.query('DELETE FROM documents WHERE id = $1', [id]);
        req.flash('success', 'Document deleted successfully');
        res.redirect('/staff/upload-document');
    } catch (err) {
        console.error('Delete document error:', err);
        req.flash('error', 'Error deleting document');
        res.redirect('/staff/upload-document');
    }
});

// Upload Result Page
router.get('/upload-result', async (req, res) => {
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
        } catch (err) { console.error(err); }
    }

    res.render('staff/upload-result', {
        title: 'Upload Student Results - Islamic School',
        page: 'upload-result',
        staff: req.session.staff,
        query: req.query,
        uploadedSubjects
    });
});

// Process Upload Result - Updated for multiple subjects and deletions
router.post('/upload-result', async (req, res) => {
    const { admission_number, class_name, subjects, scores, delete_subjects, term, academic_year } = req.body;

    // Normalize inputs (avoid whitespace/case mismatches across insert/delete paths)
    const cleanAdmissionNumber = (admission_number || '').trim();
    const cleanClassName = (class_name || '').trim();
    const cleanTerm = (term || '').trim();
    const cleanYear = (academic_year || '').trim();

    const redirectUrl = `/staff/upload-result?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&class_name=${encodeURIComponent(cleanClassName)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanYear)}`;

    try {
        // 1. Basic Validation
        if (!cleanAdmissionNumber || !cleanTerm || !cleanYear) {
            req.flash('error', 'Student admission number, term, and academic year are required.');
            return res.redirect(redirectUrl);
        }

        // 2. Find Student
        const studentResult = await db.query('SELECT id, class FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);

        if (studentResult.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect(redirectUrl);
        }

        const student = studentResult.rows[0];
        const student_id = student.id;

        // 2b. Validate Class matches Admission Number
        if (student.class && cleanClassName && student.class.toUpperCase() !== cleanClassName.toUpperCase()) {
            req.flash('error', `Class mismatch! Student ${cleanAdmissionNumber} belongs to ${student.class}, but you selected ${cleanClassName}.`);
            return res.redirect(redirectUrl);
        }

        // 3. Handle Deletions First
        let deletedCount = 0;
        console.log('Delete subjects received:', delete_subjects);
        
        if (delete_subjects && (Array.isArray(delete_subjects) ? delete_subjects.length > 0 : delete_subjects)) {
            const subjectsToDelete = Array.isArray(delete_subjects) ? delete_subjects : [delete_subjects];
            console.log('Subjects to delete:', subjectsToDelete);

            for (const subjectToDelete of subjectsToDelete) {
                try {
                    const cleanSubject = (subjectToDelete || '').trim();
                    if (!cleanSubject) continue;
                    
                    console.log(`Attempting to delete subject: "${cleanSubject}"`);

                    // First check what exists in DB
                    const checkResult = await db.query(
                        `SELECT id, subject, term, academic_year FROM results 
                         WHERE student_id = $1 
                         AND TRIM(LEAST(subject, '$2')) = TRIM(GREATEST(subject, '$2'))
                         AND TRIM(term) = $3
                         AND TRIM(academic_year) = $4`,
                        [student_id, cleanSubject, cleanTerm, cleanYear]
                    );
                    console.log('Found matching records:', checkResult.rows.length);

                    // Use a more flexible delete that handles case-insensitive matching
                    const deleteResult = await db.query(
                        `DELETE FROM results
                         WHERE student_id = $1
                         AND LOWER(TRIM(subject)) = LOWER($2)
                         AND TRIM(term) = $3
                         AND TRIM(academic_year) = $4`,
                        [student_id, cleanSubject, cleanTerm, cleanYear]
                    );

                    deletedCount += deleteResult.rowCount || 0;
                    console.log(`Deleted ${deleteResult.rowCount} records for subject: ${cleanSubject}`);
                } catch (deleteErr) {
                    console.error(`Error deleting ${subjectToDelete}:`, deleteErr);
                }
            }
        }

        // 4. Handle Updates/Inserts
        let subjectArray = [];
        let scoreArray = [];

        if (Array.isArray(subjects)) {
            subjectArray = subjects;
            scoreArray = Array.isArray(scores) ? scores : [];
        } else if (subjects && scores) {
            // Single subject case (backward compatibility)
            subjectArray = [subjects];
            scoreArray = [scores];
        }

        // Filter out empty entries
        const validEntries = subjectArray.map((subject, index) => ({
            subject: subject?.trim(),
            score: scoreArray[index]
        })).filter(entry => entry.subject && entry.score);

        let uploadedCount = 0;
        let updatedCount = 0;
        let errorMessages = [];

        // Process each valid subject
        for (const entry of validEntries) {
            try {
                const numScore = parseFloat(entry.score);

                if (isNaN(numScore) || numScore < 0 || numScore > 100) {
                    errorMessages.push(`${entry.subject}: Score must be between 0 and 100`);
                    continue;
                }

                let grade = 'F';
                if (numScore >= 70) grade = 'A';
                else if (numScore >= 60) grade = 'B';
                else if (numScore >= 50) grade = 'C';
                else if (numScore >= 45) grade = 'D';
                else if (numScore >= 40) grade = 'E';

                // Check if this subject already exists
                const existingResult = await db.query(
                    'SELECT id FROM results WHERE student_id = $1 AND subject = $2 AND term = $3 AND academic_year = $4',
                    [student_id, entry.subject.toUpperCase(), cleanTerm, cleanYear]
                );

                const exists = existingResult.rows.length > 0;

                // Insert or update
                await db.query(
                    `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      ON CONFLICT (student_id, subject, term, academic_year)
                      DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade`,
                    [student_id, entry.subject.toUpperCase(), numScore, grade, cleanTerm, cleanYear]
                );

                if (exists) {
                    updatedCount++;
                } else {
                    uploadedCount++;
                }
            } catch (subjectErr) {
                console.error(`Error processing ${entry.subject}:`, subjectErr);
                errorMessages.push(`${entry.subject}: Processing failed`);
            }
        }

        // 5. Provide Comprehensive Feedback
        let successMessages = [];
        if (deletedCount > 0) {
            successMessages.push(`🗑️ Deleted ${deletedCount} subject${deletedCount > 1 ? 's' : ''}`);
        }
        if (uploadedCount > 0) {
            successMessages.push(`✅ Added ${uploadedCount} new subject${uploadedCount > 1 ? 's' : ''}`);
        }
        if (updatedCount > 0) {
            successMessages.push(`🔄 Updated ${updatedCount} subject${updatedCount > 1 ? 's' : ''}`);
        }

        if (successMessages.length > 0) {
            req.flash('success', successMessages.join(' | '));
        }

        if (errorMessages.length > 0) {
            req.flash('error', `Some operations failed: ${errorMessages.join(', ')}`);
        }

        if (deletedCount === 0 && uploadedCount === 0 && updatedCount === 0 && validEntries.length > 0) {
            req.flash('error', 'No changes were made. Please check your input.');
        }

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Upload error:', err);
        req.flash('error', 'Error processing results. Please try again.');
        res.redirect(redirectUrl);
    }
});

// View Results Page
router.get('/view-results', async (req, res) => {
    // Check if we have query parameters (redirected from delete or manual link)
    if (req.query.admission_number && req.query.term && req.query.academic_year) {
        const { admission_number, term, academic_year } = req.query;
        
        try {
            const studentRes = await db.query(
                'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
                [admission_number]
            );

            if (studentRes.rows.length === 0) {
                req.flash('error', 'Student not found.');
                return res.render('staff/view-results', { title: 'View Results', page: 'view-results', staff: req.session.staff, search: false });
            }

            const student = studentRes.rows[0];
            const resultsRes = await db.query(
                'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
                [student.id, term, academic_year]
            );

            const results = resultsRes.rows;
            const totalScore = results.reduce((sum, r) => sum + parseFloat(r.score), 0);

            return res.render('staff/view-results', {
                title: 'View Student Results - Islamic School',
                page: 'view-results',
                staff: req.session.staff,
                search: true,
                student,
                results,
                term,
                academic_year,
                totalScore
            });
        } catch (err) {
            console.error(err);
        }
    }

    res.render('staff/view-results', {
        title: 'View Student Results - Islamic School',
        page: 'view-results',
        staff: req.session.staff,
        search: false
    });
});

// Process View Results
router.post('/view-results', async (req, res) => {
    const { admission_number, term, academic_year } = req.body;

    try {
        const studentRes = await db.query(
            'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
            [admission_number]
        );

        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect('/staff/view-results');
        }

        const student = studentRes.rows[0];
        const resultsRes = await db.query(
            'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
            [student.id, term, academic_year]
        );

        const results = resultsRes.rows;
        let totalScore = 0;
        if (results.length > 0) {
            totalScore = results.reduce((sum, result) => sum + parseFloat(result.score), 0);
        }

        res.render('staff/view-results', {
            title: 'View Student Results - Islamic School',
            page: 'view-results',
            staff: req.session.staff,
            search: true,
            student,
            results,
            term,
            academic_year,
            totalScore
        });
    } catch (err) {
        console.error('View results error:', err);
        req.flash('error', 'Error retrieving results.');
        res.redirect('/staff/view-results');
    }
});

// Add Single Result
router.post('/add-single-result', async (req, res) => {
    try {
        const { admission_number, term, academic_year, subject, score } = req.body;

        console.log('=== ADD SINGLE RESULT START ===');
        console.log('Add request data:', { admission_number, term, academic_year, subject, score });

        // Clean up parameters
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();
        const cleanScore = parseFloat(score);

        console.log('Cleaned parameters:', { 
            cleanAdmissionNumber, 
            cleanTerm, 
            cleanAcademicYear, 
            cleanSubject,
            cleanScore
        });

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject || isNaN(cleanScore)) {
            console.log('❌ Validation failed - missing or invalid parameters');
            req.flash('error', 'Missing required parameters for adding result.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Validate score range
        if (cleanScore < 0 || cleanScore > 100) {
            console.log('❌ Invalid score range:', cleanScore);
            req.flash('error', 'Score must be between 0 and 100.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Find student by admission number
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        
        if (studentRes.rows.length === 0) {
            console.log('❌ Student not found:', cleanAdmissionNumber);
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }
        
        const student_id = studentRes.rows[0].id;
        console.log('✅ Student found, ID:', student_id);

        // Calculate grade based on score
        let grade = 'F';
        if (cleanScore >= 70) grade = 'A';
        else if (cleanScore >= 60) grade = 'B';
        else if (cleanScore >= 50) grade = 'C';
        else if (cleanScore >= 45) grade = 'D';
        else if (cleanScore >= 40) grade = 'E';

        console.log(`Calculated grade: ${grade} for score: ${cleanScore}`);

        // Insert the new result
        const insertResult = await db.query(
            `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (student_id, subject, term, academic_year)
             DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [student_id, cleanSubject, cleanScore, grade, cleanTerm, cleanAcademicYear]
        );
        
        console.log('Insert query result:', insertResult.rows);
        console.log('Number of rows affected:', insertResult.rows.length);
        
        if (insertResult.rows.length > 0) {
            const isUpdate = insertResult.rows[0].created_at !== insertResult.rows[0].updated_at;
            console.log(isUpdate ? '✅ Successfully updated existing result:' : '✅ Successfully added new result:');
            console.log(insertResult.rows[0]);
            req.flash('success', `Successfully ${isUpdate ? 'updated' : 'added'} ${subject} result.`);
        } else {
            console.log('❌ No result was inserted or updated');
            req.flash('warning', `No ${subject} result was added. Please try again.`);
        }
        
    } catch (err) {
        console.error('❌ Add result error:', err);
        req.flash('error', `Error adding result: ${err.message}`);
    }

    // Redirect back to view results with query params so the table reloads
    const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(req.body.admission_number)}&term=${encodeURIComponent(req.body.term)}&academic_year=${encodeURIComponent(req.body.academic_year)}`;
    console.log('=== ADD SINGLE RESULT END ===');
    res.redirect(redirectUrl);
});

// Edit Single Result
router.post('/edit-result/:admission_number/:term/*', async (req, res) => {
    try {
        const { admission_number, term } = req.params;
        const academic_year = req.params[0];
        const { subject, old_subject, score, grade } = req.body;

        console.log('=== EDIT REQUEST START ===');
        console.log('Edit data:', { subject, old_subject, score, grade });

        // Clean up parameters
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();
        const cleanOldSubject = (old_subject || subject).trim().toUpperCase();
        const cleanScore = parseFloat(score);
        const cleanGrade = grade.trim();

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject || isNaN(cleanScore)) {
            req.flash('error', 'Missing required parameters for editing.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Validate score range
        if (cleanScore < 0 || cleanScore > 100) {
            req.flash('error', 'Score must be between 0 and 100.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        // Find student
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }
        const student_id = studentRes.rows[0].id;

        // Update the specific result
        const updateResult = await db.query(
            `UPDATE results 
             SET subject = $1, score = $2, grade = $3, updated_at = CURRENT_TIMESTAMP
             WHERE student_id = $4 
             AND UPPER(TRIM(subject)) = $5 
             AND TRIM(term) = $6 
             AND TRIM(academic_year) = $7 
             RETURNING *`,
            [cleanSubject, cleanScore, cleanGrade, student_id, cleanOldSubject, cleanTerm, cleanAcademicYear]
        );
        
        if (updateResult.rows.length > 0) {
            req.flash('success', `Successfully updated ${subject} result.`);
        } else {
            req.flash('warning', `No ${old_subject || subject} result found to update.`);
        }
        
    } catch (err) {
        console.error('❌ Edit error:', err);
        req.flash('error', `Error editing result: ${err.message}`);
    }

    res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(req.params.admission_number)}&term=${encodeURIComponent(req.params.term)}&academic_year=${encodeURIComponent(req.params[0])}`);
});

// Delete Single Result
router.post('/delete-result', async (req, res) => {
    try {
        const { admission_number, term, academic_year, subject } = req.body;

        console.log('=== DELETE REQUEST START ===');
        console.log('Data from body:', { admission_number, term, academic_year, subject });

        // Clean up parameters
        const cleanAdmissionNumber = (admission_number || '').trim();
        const cleanTerm = (term || '').trim();
        const cleanAcademicYear = (academic_year || '').trim();
        const cleanSubject = (subject || '').trim().toUpperCase();

        const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`;

        // Validate input parameters
        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject) {
            req.flash('error', 'Missing required parameters for deletion.');
            return res.redirect(redirectUrl);
        }

        // Find student
        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect(redirectUrl);
        }
        const student_id = studentRes.rows[0].id;

        // Delete the specific result
        const deleteResult = await db.query(
            `DELETE FROM results 
             WHERE student_id = $1 
             AND UPPER(TRIM(subject)) = $2 
             AND TRIM(term) = $3 
             AND TRIM(academic_year) = $4 
             RETURNING *`,
            [student_id, cleanSubject, cleanTerm, cleanAcademicYear]
        );
        
        if (deleteResult.rows.length > 0) {
            req.flash('success', `Successfully deleted ${subject} record.`);
        } else {
            req.flash('warning', `Record not found or already deleted.`);
        }
        
        res.redirect(redirectUrl);
    } catch (err) {
        console.error('❌ Delete error:', err);
        req.flash('error', `Error deleting record: ${err.message}`);
        res.redirect('/staff/view-results');
    }
});

// Manage Students Page
router.get('/manage-students', async (req, res) => {
    try {
        const studentsRes = await db.query('SELECT * FROM students ORDER BY created_at DESC');
        res.render('staff/manage-students', {
            title: 'Manage Students - Islamic School',
            page: 'manage-students',
            staff: req.session.staff,
            students: studentsRes.rows
        });
    } catch (err) {
        console.error('Error fetching students:', err);
        req.flash('error', 'Could not load students list');
        res.redirect('/staff/dashboard');
    }
});

// Delete Student Route
router.post('/delete-student/:id', async (req, res) => {
    try {
        console.log('Delete student route called with ID:', req.params.id);
        const studentId = req.params.id;

        // First, check if student exists
        const studentCheck = await db.query('SELECT first_name, last_name, admission_number FROM students WHERE id = $1', [studentId]);
        console.log('Student check result:', studentCheck.rows.length);
        if (studentCheck.rows.length === 0) {
            req.flash('error', 'Student not found');
            return res.redirect('/staff/manage-students');
        }

        const student = studentCheck.rows[0];
        console.log('Deleting student:', student.first_name, student.last_name);

        // Get user_id before deleting
        const userId = studentCheck.rows[0].user_id;
        console.log('Associated user_id:', userId);

        // Delete results first (though CASCADE should handle this)
        const resultsDelete = await db.query('DELETE FROM results WHERE student_id = $1', [studentId]);
        console.log('Deleted results:', resultsDelete.rowCount);

        // Delete the student
        const studentDelete = await db.query('DELETE FROM students WHERE id = $1', [studentId]);
        console.log('Deleted student:', studentDelete.rowCount);

        // Delete the user (this will CASCADE delete the student if not already deleted)
        const userDelete = await db.query('DELETE FROM users WHERE id = $1', [userId]);
        console.log('Deleted user:', userDelete.rowCount);

        req.flash('success', `Student ${student.first_name} ${student.last_name} (ID: ${student.admission_number}) has been permanently deleted`);
        res.redirect('/staff/manage-students');

    } catch (err) {
        console.error('Error deleting student:', err);
        req.flash('error', `Could not delete student: ${err.message}`);
        res.redirect('/staff/manage-students');
    }
});

// Export Students PDF by Class
router.get('/export-students-pdf', async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');

        // Query students grouped by class
        const studentsRes = await db.query(`
            SELECT class, first_name, last_name, admission_number, gender, parent_name, parent_phone
            FROM students
            WHERE class IS NOT NULL AND class != ''
            ORDER BY class, last_name, first_name
        `);

        const students = studentsRes.rows;

        // Group students by class
        const studentsByClass = {};
        students.forEach(student => {
            const className = student.class;
            if (!studentsByClass[className]) {
                studentsByClass[className] = [];
            }
            studentsByClass[className].push(student);
        });

        // Create PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="students-by-class.pdf"');

        // Pipe PDF to response
        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Islamic School Management System', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text('Student Registry by Class', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'center' });
        doc.moveDown(2);

        // Process each class
        const classNames = Object.keys(studentsByClass).sort();

        classNames.forEach((className, classIndex) => {
            const classStudents = studentsByClass[className];

            // Class header
            doc.fontSize(14).font('Helvetica-Bold').text(`${className} (${classStudents.length} students)`, { underline: true });
            doc.moveDown();

            // Student list
            doc.font('Helvetica').fontSize(10);
            classStudents.forEach((student, index) => {
                const fullName = `${student.first_name} ${student.last_name}`;
                const admission = student.admission_number || 'N/A';
                const gender = (student.gender || 'N/A').toUpperCase();
                const parent = student.parent_name || 'N/A';
                const phone = student.parent_phone || 'N/A';

                doc.text(`${index + 1}. ${fullName} (${admission})`);
                doc.fontSize(9).text(`   Gender: ${gender} | Parent: ${parent} | Phone: ${phone}`);
                doc.moveDown(0.5);
            });

            doc.moveDown();

            // Add page break between classes (except for the last one)
            if (classIndex < classNames.length - 1) {
                doc.addPage();
            }
        });

        // Footer
        doc.fontSize(8).font('Helvetica-Oblique').text('Islamic School Management System - Confidential Document', 50, doc.page.height - 50, {
            align: 'center',
            width: doc.page.width - 100
        });

        // Finalize PDF
        doc.end();

    } catch (err) {
        console.error('Error generating PDF:', err);
        req.flash('error', 'Could not generate PDF report');
        res.redirect('/staff/manage-students');
    }
});

// Announcements Page
router.get('/announcements', async (req, res) => {
    try {
        const announcementsRes = await db.query(
            'SELECT * FROM announcements ORDER BY created_at DESC'
        );
        
        // Calculate counts for stats
        const announcements = announcementsRes.rows;
        const stats = {
            total: announcements.length,
            active: announcements.filter(a => a.status === 'published').length,
            draft: announcements.filter(a => a.status === 'draft').length,
            expired: announcements.filter(a => a.status === 'expired' || (a.expiry_date && new Date(a.expiry_date) < new Date())).length
        };

        res.render('staff/announcements', {
            title: 'Announcements - Islamic School',
            page: 'announcements',
            staff: req.session.staff,
            announcements,
            stats
        });
    } catch (err) {
        console.error('Error fetching announcements:', err);
        req.flash('error', 'Error loading announcements');
        res.redirect('/staff/dashboard');
    }
});

// Create Announcement
router.post('/announcements/create', async (req, res) => {
    try {
        const { title, content, priority, status, expiry_date, target_audience } = req.body;
        // staff user_id is in session
        const author_id = req.session.staff.user_id;

        await db.query(
            `INSERT INTO announcements (title, content, author_id, priority, status, expiry_date, target_audience)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [title, content, author_id, priority, status, expiry_date || null, target_audience || 'all']
        );

        req.flash('success', 'Announcement created successfully');
        res.redirect('/staff/announcements');
    } catch (err) {
        console.error('Create announcement error:', err);
        req.flash('error', 'Error creating announcement');
        res.redirect('/staff/announcements');
    }
});

// Delete Announcement
router.post('/announcements/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        req.flash('success', 'Announcement deleted successfully');
        res.redirect('/staff/announcements');
    } catch (err) {
        console.error('Delete announcement error:', err);
        req.flash('error', 'Error deleting announcement');
        res.redirect('/staff/announcements');
    }
});

// Generate PDF Result for Staff View
router.get('/download-result/:admission_number/:term/:academic_year', async (req, res) => {
    const { admission_number, term, academic_year } = req.params;

    try {
        // Get student info
        const studentRes = await db.query(
            'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
            [admission_number]
        );

        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect('/staff/view-results');
        }

        const student = studentRes.rows[0];

        // Get results
        const resultsRes = await db.query(
            'SELECT subject, score, grade FROM results WHERE student_id = $1 AND term = $2 AND academic_year = $3 ORDER BY subject',
            [student.id, term, academic_year]
        );

        const results = resultsRes.rows;

        if (results.length === 0) {
            req.flash('error', 'No results found for this student in the selected term and year.');
            return res.redirect('/staff/view-results');
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
            const filename = `Academic_Result_${student.first_name}_${student.last_name}_${term.replace(' ', '_')}_${academic_year.replace('/', '_')}.pdf`;
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
        doc.font('Helvetica').text(`${student.first_name} ${student.last_name}`, 130, startY);
        
        doc.font('Helvetica-Bold').text('Admission No:', 50, startY + 20);
        doc.font('Helvetica').text(student.admission_number, 130, startY + 20);
        
        // Right Column
        doc.font('Helvetica-Bold').text('Class:', 350, startY);
        doc.font('Helvetica').text(student.class || 'N/A', 420, startY);
        
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
        res.redirect('/staff/view-results');
    }
});
// Edit Student Page
router.get('/edit-student/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const studentRes = await db.query('SELECT * FROM students WHERE id = $1', [id]);
        
        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found');
            return res.redirect('/staff/manage-students');
        }

        res.render('staff/edit-student', {
            title: 'Edit Student - Islamic School',
            page: 'manage-students',
            staff: req.session.staff,
            student: studentRes.rows[0],
            error_msg: req.flash('error'),
            success_msg: req.flash('success')
        });
    } catch (err) {
        console.error('Edit student page error:', err);
        res.redirect('/staff/manage-students');
    }
});

// Update Student
router.post('/edit-student/:id', uploadStudentPicture.single('profile_picture'), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            first_name, last_name, class_name, 
            gender, date_of_birth, passport, parent_name, 
            parent_phone, parent_email, address
        } = req.body;

        // Handle profile picture
        let picturePath = null;
        if (req.file) {
            picturePath = '/uploads/students/' + req.file.filename;
        }

        // Build dynamic update query
        let updateFields = [];
        let values = [];
        let paramIndex = 1;

        const fields = {
            first_name, last_name, class: class_name, gender, 
            date_of_birth: date_of_birth || null, 
            passport: passport || null,
            parent_name, parent_phone, parent_email, address
        };

        if (picturePath) {
            fields.picture = picturePath;
        }

        Object.keys(fields).forEach(key => {
            if (fields[key] !== undefined) {
                updateFields.push(`${key} = $${paramIndex}`);
                values.push(fields[key]);
                paramIndex++;
            }
        });

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const updateQuery = `
            UPDATE students 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
        `;

        await db.query(updateQuery, values);

        req.flash('success', 'Student details updated successfully');
        res.redirect('/staff/manage-students');
    } catch (err) {
        console.error('Update student error:', err);
        req.flash('error', 'Error updating student record');
        res.redirect(`/staff/edit-student/${req.params.id}`);
    }
});

// =================== CONTACT MESSAGES ===================

// List all contact messages
router.get('/contact-messages', async (req, res) => {
    try {
        const messagesRes = await db.query(
            'SELECT * FROM contact_messages ORDER BY created_at DESC'
        );
        const unreadCount = messagesRes.rows.filter(m => m.status === 'unread').length;
        res.render('staff/contact-messages', {
            title: 'Contact Messages - Islamic School',
            page: 'contact-messages',
            staff: req.session.staff,
            messages: messagesRes.rows,
            unreadCount
        });
    } catch (err) {
        console.error('Error fetching contact messages:', err);
        req.flash('error', 'Error loading messages');
        res.redirect('/staff/dashboard');
    }
});

// View a single contact message (marks as read)
router.get('/contact-messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Mark as read
        await db.query(
            `UPDATE contact_messages SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'unread'`,
            [id]
        );
        const msgRes = await db.query('SELECT * FROM contact_messages WHERE id = $1', [id]);
        if (msgRes.rows.length === 0) {
            req.flash('error', 'Message not found');
            return res.redirect('/staff/contact-messages');
        }
        res.render('staff/contact-message-view', {
            title: 'View Message - Islamic School',
            page: 'contact-messages',
            staff: req.session.staff,
            message: msgRes.rows[0]
        });
    } catch (err) {
        console.error('Error viewing message:', err);
        req.flash('error', 'Error loading message');
        res.redirect('/staff/contact-messages');
    }
});

// Reply to a contact message
router.post('/contact-messages/:id/reply', async (req, res) => {
    try {
        const { id } = req.params;
        const { reply_message } = req.body;

        const msgRes = await db.query('SELECT * FROM contact_messages WHERE id = $1', [id]);
        if (msgRes.rows.length === 0) {
            req.flash('error', 'Message not found');
            return res.redirect('/staff/contact-messages');
        }
        const original = msgRes.rows[0];

        // Send reply email
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: `Islamic School <${process.env.EMAIL_USER}>`,
            to: original.email,
            replyTo: process.env.EMAIL_USER,
            subject: `Re: ${original.subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h2 style="margin: 0;">Islamic School Management System</h2>
                        <p style="margin: 5px 0 0 0;">Reply to your message</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                        <p>Dear <strong>${original.name}</strong>,</p>
                        <div style="background-color: #fff; padding: 15px; border-left: 4px solid #1a5f3f; border-radius: 3px; margin: 15px 0;">
                            <p style="margin: 0; white-space: pre-wrap;">${reply_message}</p>
                        </div>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 0.85em;"><strong>Your original message:</strong><br>${original.message}</p>
                        <p>JazakAllah Khair,<br><strong>Islamic School Management</strong></p>
                    </div>
                </div>
            `
        });

        // Update message status in DB
        await db.query(
            `UPDATE contact_messages SET status = 'replied', reply_message = $1, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [reply_message, id]
        );

        req.flash('success', `Reply sent successfully to ${original.email}`);
        res.redirect(`/staff/contact-messages/${id}`);
    } catch (err) {
        console.error('Reply error:', err);
        req.flash('error', 'Error sending reply. Please try again.');
        res.redirect(`/staff/contact-messages/${req.params.id}`);
    }
});

// Delete a contact message
router.post('/contact-messages/:id/delete', async (req, res) => {
    try {
        await db.query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
        req.flash('success', 'Message deleted successfully');
        res.redirect('/staff/contact-messages');
    } catch (err) {
        console.error('Delete message error:', err);
        req.flash('error', 'Error deleting message');
        res.redirect('/staff/contact-messages');
    }
});

// GET Student Info API (for frontend validation)
router.get('/api/student/:admission_number', async (req, res) => {
    try {
        const { admission_number } = req.params;
        const result = await db.query(
            'SELECT first_name, last_name, class FROM students WHERE admission_number = $1',
            [admission_number]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, student: result.rows[0] });
        } else {
            res.json({ success: false, message: 'Student not found' });
        }
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
