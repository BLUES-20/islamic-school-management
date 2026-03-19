const bcrypt = require('bcrypt');
const db = require('./db');

/**
 * Admin creates new student account (no payment required)
 * @param {Object} studentData - {first_name, last_name, email, password, class_name, ...}
 * @param {string} adminEmail - Admin email for notification
 * @returns {Promise<{success: bool, admission_number: string, error: string|null}>}
 */
async function createStudentByAdmin(studentData, adminEmail) {
    const {
        first_name,
        last_name,
        email,
        password,
        class_name,
        date_of_birth,
        gender,
        parent_name,
        parent_phone,
        address,
        picturePath
    } = studentData;

    // Validation
    if (!first_name || !last_name || !email || !password) {
        return { success: false, error: 'Missing required fields: name, email, password' };
    }
    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
    }

    try {
        // Check email exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return { success: false, error: 'Email already registered' };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate admission_number
        const year = new Date().getFullYear();
        const countResult = await db.query('SELECT COUNT(*) FROM students WHERE admission_number LIKE $1', [`STU${year}%`]);
        const count = parseInt(countResult.rows[0].count) + 1;
        const admission_number = `STU${year}${count.toString().padStart(3, '0')}`;

        // Create user
        const userResult = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [email, email, hashedPassword, 'student']
        );
        const user_id = userResult.rows[0].id;

        // Create student
        await db.query(
            `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, picture, class, parent_name, parent_phone, address)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [user_id, admission_number, first_name, last_name, email, date_of_birth || null, gender || null, picturePath || null, class_name || null, parent_name || null, parent_phone || null, address || null]
        );

        // Notify admin
        const { sendEmail } = require('./email');
        const adminHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a5f3f, #2d8a5e); color: white; padding: 25px; text-align: center; border-radius: 12px;">
                    <h2>New Student Added by Admin</h2>
                </div>
                <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
                    <p><strong>Student:</strong> ${first_name} ${last_name}</p>
                    <p><strong>Admission #:</strong> <span style="font-size: 1.2em; color: #1a5f3f;">${admission_number}</span></p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Class:</strong> ${class_name}</p>
                    <p style="color: #666; font-size: 0.9em;">Added: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;
        await sendEmail(adminEmail, `New Student Registered - ${admission_number}`, adminHtml);

        return { success: true, admission_number };
    } catch (error) {
        console.error('Admin student registration error:', error);
        return { success: false, error: 'Database error: ' + error.message };
    }
}

module.exports = { createStudentByAdmin };
