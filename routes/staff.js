// routes/staff.js
const express = require('express');
const router = express.Router();
const db = require('../config/supabase');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import Cloudinary storage
const {
    studentStorage,
    documentStorage,
    cloudinary
} = require('../config/cloudinary');

// Configure Multer for Student Picture Uploads - Using Cloudinary
const uploadStudentPicture = multer({
    storage: studentStorage,
    limits: {
        fileSize: 2 * 1024 * 1024
    }, // 2MB
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

// Configure Multer for Document Uploads - Using Cloudinary
const uploadDocument = multer({
    storage: documentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }, // 10MB for documents
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
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const studentCount = countResult.rows[0].count;
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

// Process Document Upload - Cloudinary version
router.post('/upload-document', uploadDocument.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Please select a file to upload');
            return res.redirect('/staff/upload-document');
        }

        const {
            title,
            description,
            document_type,
            target_audience
        } = req.body;
        const author_id = req.session.staff.user_id;

        // Cloudinary provides secure_url
        const file_path = req.file.path;
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

// Delete Document - Cloudinary version
router.post('/delete-document/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;

        // Get file path first
        const docRes = await db.query('SELECT file_path FROM documents WHERE id = $1', [id]);
        if (docRes.rows.length > 0) {
            const filePath = docRes.rows[0].file_path;
            // If it's a Cloudinary URL, extract public_id and delete
            if (filePath && filePath.includes('cloudinary')) {
                try {
                    const publicId = filePath.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`islamic-school/documents/${publicId}`);
                } catch (cloudErr) {
                    console.log('Cloudinary delete error:', cloudErr.message);
                }
            } else {
                // Local file fallback
                const localPath = path.join(__dirname, '../public', filePath);
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
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
        title: 'Upload Student Results - Islamic School',
        page: 'upload-result',
        staff: req.session.staff,
        query: req.query,
        uploadedSubjects
    });
});

// Process Upload Result
router.post('/upload-result', async (req, res) => {
    const {
        admission_number,
        class_name,
        subjects,
        scores,
        delete_subjects,
        term,
        academic_year
    } = req.body;

    const cleanAdmissionNumber = (admission_number || '').trim();
    const cleanClassName = (class_name || '').trim();
    const cleanTerm = (term || '').trim();
    const cleanYear = (academic_year || '').trim();

    const redirectUrl = `/staff/upload-result?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&class_name=${encodeURIComponent(cleanClassName)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanYear)}`;

    try {
        if (!cleanAdmissionNumber || !cleanTerm || !cleanYear) {
            req.flash('error', 'Student admission number, term, and academic year are required.');
            return res.redirect(redirectUrl);
        }

        const studentResult = await db.query('SELECT id, class FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        if (studentResult.rows.length === 0) {
            req.flash('error', 'Student with that admission number not found.');
            return res.redirect(redirectUrl);
        }

        const student = studentResult.rows[0];
        const student_id = student.id;

        if (student.class && cleanClassName && student.class.toUpperCase() !== cleanClassName.toUpperCase()) {
            req.flash('error', `Class mismatch! Student ${cleanAdmissionNumber} belongs to ${student.class}, but you selected ${cleanClassName}.`);
            return res.redirect(redirectUrl);
        }

        // Handle deletions
        let deletedCount = 0;
        if (delete_subjects && (Array.isArray(delete_subjects) ? delete_subjects.length > 0 : delete_subjects)) {
            const subjectsToDelete = Array.isArray(delete_subjects) ? delete_subjects : [delete_subjects];
            for (const subjectToDelete of subjectsToDelete) {
                try {
                    const cleanSubject = (subjectToDelete || '').trim();
                    if (!cleanSubject) continue;

                    const deleteResult = await db.query(
                        `DELETE FROM results WHERE student_id = $1 AND LOWER(TRIM(subject)) = LOWER($2) AND TRIM(term) = $3 AND TRIM(academic_year) = $4`,
                        [student_id, cleanSubject, cleanTerm, cleanYear]
                    );
                    deletedCount += deleteResult.rowCount || 0;
                } catch (deleteErr) {
                    console.error(`Error deleting ${subjectToDelete}:`, deleteErr);
                }
            }
        }

        // Handle updates/inserts
        let subjectArray = [];
        let scoreArray = [];

        if (Array.isArray(subjects)) {
            subjectArray = subjects;
            scoreArray = Array.isArray(scores) ? scores : [];
        } else if (subjects && scores) {
            subjectArray = [subjects];
            scoreArray = [scores];
        }

        const validEntries = subjectArray.map((subject, index) => ({
            subject: subject?.trim(),
            score: scoreArray[index]
        })).filter(entry => entry.subject && entry.score);

        let uploadedCount = 0;
        let updatedCount = 0;
        let errorMessages = [];

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

                const existingResult = await db.query(
                    'SELECT id FROM results WHERE student_id = $1 AND subject = $2 AND term = $3 AND academic_year = $4',
                    [student_id, entry.subject.toUpperCase(), cleanTerm, cleanYear]
                );
                const exists = existingResult.rows.length > 0;

                await db.query(
                    `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      ON CONFLICT (student_id, subject, term, academic_year)
                      DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade`,
                    [student_id, entry.subject.toUpperCase(), numScore, grade, cleanTerm, cleanYear]
                );

                if (exists) updatedCount++;
                else uploadedCount++;
            } catch (subjectErr) {
                errorMessages.push(`${entry.subject}: Processing failed`);
            }
        }

        let successMessages = [];
        if (deletedCount > 0) successMessages.push(`🗑️ Deleted ${deletedCount} subject(s)`);
        if (uploadedCount > 0) successMessages.push(`✅ Added ${uploadedCount} new subject(s)`);
        if (updatedCount > 0) successMessages.push(`🔄 Updated ${updatedCount} subject(s)`);

        if (successMessages.length > 0) req.flash('success', successMessages.join(' | '));
        if (errorMessages.length > 0) req.flash('error', `Some operations failed: ${errorMessages.join(', ')}`);
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
    if (req.query.admission_number && req.query.term && req.query.academic_year) {
        const {
            admission_number,
            term,
            academic_year
        } = req.query;

        try {
            const studentRes = await db.query(
                'SELECT id, first_name, last_name, admission_number, class FROM students WHERE admission_number = $1',
                [admission_number]
            );

            if (studentRes.rows.length === 0) {
                req.flash('error', 'Student not found.');
                return res.render('staff/view-results', {
                    title: 'View Results',
                    page: 'view-results',
                    staff: req.session.staff,
                    search: false
                });
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
    const {
        admission_number,
        term,
        academic_year
    } = req.body;

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
        const totalScore = results.reduce((sum, result) => sum + parseFloat(result.score), 0);

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
        const {
            admission_number,
            term,
            academic_year,
            subject,
            score
        } = req.body;
        const cleanAdmissionNumber = admission_number.trim();
        const cleanTerm = term.trim();
        const cleanAcademicYear = academic_year.trim();
        const cleanSubject = subject.trim().toUpperCase();
        const cleanScore = parseFloat(score);

        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject || isNaN(cleanScore)) {
            req.flash('error', 'Missing required parameters for adding result.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        if (cleanScore < 0 || cleanScore > 100) {
            req.flash('error', 'Score must be between 0 and 100.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect(`/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`);
        }

        const student_id = studentRes.rows[0].id;

        let grade = 'F';
        if (cleanScore >= 70) grade = 'A';
        else if (cleanScore >= 60) grade = 'B';
        else if (cleanScore >= 50) grade = 'C';
        else if (cleanScore >= 45) grade = 'D';
        else if (cleanScore >= 40) grade = 'E';

        const insertResult = await db.query(
            `INSERT INTO results (student_id, subject, score, grade, term, academic_year)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (student_id, subject, term, academic_year)
             DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [student_id, cleanSubject, cleanScore, grade, cleanTerm, cleanAcademicYear]
        );

        if (insertResult.rows.length > 0) {
            const isUpdate = insertResult.rows[0].created_at !== insertResult.rows[0].updated_at;
            req.flash('success', `Successfully ${isUpdate ? 'updated' : 'added'} ${subject} result.`);
        } else {
            req.flash('warning', `No ${subject} result was added. Please try again.`);
        }
    } catch (err) {
        console.error('Add result error:', err);
        req.flash('error', `Error adding result: ${err.message}`);
    }

    const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(req.body.admission_number)}&term=${encodeURIComponent(req.body.term)}&academic_year=${encodeURIComponent(req.body.academic_year)}`;
    res.redirect(redirectUrl);
});

// Delete Single Result
router.post('/delete-result', async (req, res) => {
    try {
        const {
            admission_number,
            term,
            academic_year,
            subject
        } = req.body;
        const cleanAdmissionNumber = (admission_number || '').trim();
        const cleanTerm = (term || '').trim();
        const cleanAcademicYear = (academic_year || '').trim();
        const cleanSubject = (subject || '').trim().toUpperCase();

        const redirectUrl = `/staff/view-results?admission_number=${encodeURIComponent(cleanAdmissionNumber)}&term=${encodeURIComponent(cleanTerm)}&academic_year=${encodeURIComponent(cleanAcademicYear)}`;

        if (!cleanAdmissionNumber || !cleanTerm || !cleanAcademicYear || !cleanSubject) {
            req.flash('error', 'Missing required parameters for deletion.');
            return res.redirect(redirectUrl);
        }

        const studentRes = await db.query('SELECT id FROM students WHERE admission_number = $1', [cleanAdmissionNumber]);
        if (studentRes.rows.length === 0) {
            req.flash('error', 'Student not found.');
            return res.redirect(redirectUrl);
        }
        const student_id = studentRes.rows[0].id;

        const deleteResult = await db.query(
            `DELETE FROM results WHERE student_id = $1 AND UPPER(TRIM(subject)) = $2 AND TRIM(term) = $3 AND TRIM(academic_year) = $4 RETURNING *`,
            [student_id, cleanSubject, cleanTerm, cleanAcademicYear]
        );

        if (deleteResult.rows.length > 0) {
            req.flash('success', `Successfully deleted ${subject} record.`);
        } else {
            req.flash('warning', `Record not found or already deleted.`);
        }

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Delete error:', err);
        req.flash('error', `Error deleting record: ${err.message}`);
        res.redirect('/staff/view-results');
    }
});

// Manage Students Page
router.get('/manage-students', async (req, res) => {
    try {
        const studentsRes = await db.query("SELECT * FROM students WHERE payment_status = 'paid' ORDER BY created_at DESC");
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
        const studentId = req.params.id;
        const studentCheck = await db.query('SELECT first_name, last_name, admission_number, user_id FROM students WHERE id = $1', [studentId]);

        if (studentCheck.rows.length === 0) {
            req.flash('error', 'Student not found');
            return res.redirect('/staff/manage-students');
        }

        const student = studentCheck.rows[0];
        const userId = student.user_id;

        await db.query('DELETE FROM results WHERE student_id = $1', [studentId]);
        await db.query('DELETE FROM students WHERE id = $1', [studentId]);
        await db.query('DELETE FROM users WHERE id = $1', [userId]);

        req.flash('success', `Student ${student.first_name} ${student.last_name} (ID: ${student.admission_number}) has been permanently deleted`);
        res.redirect('/staff/manage-students');
    } catch (err) {
        console.error('Error deleting student:', err);
        req.flash('error', `Could not delete student: ${err.message}`);
        res.redirect('/staff/manage-students');
    }
});

// Announcements Page
router.get('/announcements', async (req, res) => {
    try {
        const announcementsRes = await db.query('SELECT * FROM announcements ORDER BY created_at DESC');
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
        const {
            title,
            content,
            priority,
            status,
            expiry_date,
            target_audience
        } = req.body;
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
        const {
            id
        } = req.params;
        await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        req.flash('success', 'Announcement deleted successfully');
        res.redirect('/staff/announcements');
    } catch (err) {
        console.error('Delete announcement error:', err);
        req.flash('error', 'Error deleting announcement');
        res.redirect('/staff/announcements');
    }
});

// Edit Student Page
router.get('/edit-student/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;
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

// Update Student - Cloudinary version
router.post('/edit-student/:id', uploadStudentPicture.single('profile_picture'), async (req, res) => {
    // Handle multer file validation error
    if (req.fileValidationError) {
        req.flash('error', req.fileValidationError.message);
        return res.redirect(`/staff/edit-student/${req.params.id}`);
    }

    try {
        const { id } = req.params;
        const body = req.body || {};
        const {
            first_name,
            last_name,
            class_name,
            gender,
            date_of_birth,
            passport,
            parent_name,
            parent_phone,
            parent_email,
            address
        } = body;

        // Validate required fields
        if (!first_name || !last_name || !class_name || !parent_name || !parent_phone) {
            req.flash('error', 'Please fill in all required fields (Name, Class, Parent Name, Parent Phone)');
            return res.redirect(`/staff/edit-student/${id}`);
        }

        console.log(`📝 Updating student ${id}: ${first_name} ${last_name}`);

        // Check if student exists
        const checkStudent = await db.query('SELECT id FROM students WHERE id = $1', [id]);
        if (checkStudent.rows.length === 0) {
            console.error(`❌ Student ID ${id} not found`);
            req.flash('error', 'Student record not found');
            return res.redirect('/staff/manage-students');
        }

        // Handle profile picture - Cloudinary returns path as secure_url
        let picturePath = null;
        if (req.file && req.file.path) {
            picturePath = req.file.path;
            console.log(`🖼️ New picture uploaded: ${picturePath}`);
        }

        // Build dynamic update query
        let updateFields = [];
        let values = [];
        let paramIndex = 1;

        const fields = {
            first_name,
            last_name,
            class: class_name,
            gender: gender || null,
            date_of_birth: date_of_birth || null,
            passport: passport || null,
            parent_name,
            parent_phone,
            parent_email: parent_email || null,
            address: address || null
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

        const updateQuery = `UPDATE students SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
        
        console.log(`📋 Update query: ${updateQuery}`);
        console.log(`📊 Updating fields: ${updateFields.length - 1} fields`);

        const result = await db.query(updateQuery, values);
        
        if (result.rowCount === 0) {
            console.error(`❌ No rows updated for student ${id}`);
            req.flash('error', 'Failed to update student record');
            return res.redirect(`/staff/edit-student/${id}`);
        }

        console.log(`✅ Student ${id} updated successfully (rows affected: ${result.rowCount})`);
        
        req.flash('success', '✅ Student details updated successfully');
        res.redirect('/staff/manage-students');
    } catch (err) {
        console.error('❌ Update student error:', err);
        req.flash('error', `Error updating student record: ${err.message}`);
        res.redirect(`/staff/edit-student/${req.params.id}`);
    }
});

// =================== CONTACT MESSAGES ===================

// List all contact messages
router.get('/contact-messages', async (req, res) => {
    try {
        const messagesRes = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
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

// View a single contact message
router.get('/contact-messages/:id', async (req, res) => {
    try {
        const {
            id
        } = req.params;
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
        const {
            id
        } = req.params;
        const {
            reply_message
        } = req.body;

        const msgRes = await db.query('SELECT * FROM contact_messages WHERE id = $1', [id]);
        if (msgRes.rows.length === 0) {
            req.flash('error', 'Message not found');
            return res.redirect('/staff/contact-messages');
        }
        const original = msgRes.rows[0];

        const {
            sendEmail
        } = require('../services/email');

        await sendEmail(original.email, `Re: ${original.subject}`, `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Islamic School Management System</h2>
                        <p>Reply to your message</p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd;">
                        <p>Dear <strong>${original.name}</strong>,</p>
                        <div style="background-color: #fff; padding: 15px; border-left: 4px solid #1a5f3f;">
                            <p style="margin: 0; white-space: pre-wrap;">${reply_message}</p>
                        </div>
                        <p>JazakAllah Khair,<br><strong>Islamic School Management</strong></p>
                    </div>
            `, {
            replyTo: process.env.EMAIL_USER,
            from: `Islamic School <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'onboarding@resend.dev'}>`
        });

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

// GET Student Info API
router.get('/api/student/:admission_number', async (req, res) => {
    try {
        const {
            admission_number
        } = req.params;
        const result = await db.query(
            'SELECT first_name, last_name, class FROM students WHERE admission_number = $1',
            [admission_number]
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                student: result.rows[0]
            });
        } else {
            res.json({
                success: false,
                message: 'Student not found'
            });
        }
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
