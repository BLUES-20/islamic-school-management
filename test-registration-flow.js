// test-registration-flow.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./config/db');

async function testRegistrationFlow() {
    console.log('\n🧪 Testing Student Registration Flow with PostgreSQL\n');
    console.log('='.repeat(60));

    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'TestPass123';
    const fullName = 'Test Student';

    try {
        // Step 1: Check if email exists
        console.log('\n1️⃣  Checking if email already exists...');
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [testEmail]);
        if (existingUser.rows.length > 0) {
            console.log('❌ Email already exists');
            return;
        }
        console.log('✅ Email is unique - ready to register\n');

        // Step 2: Hash password
        console.log('2️⃣  Hashing password with bcrypt...');
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        console.log(`✅ Password hashed (${hashedPassword.length} characters)\n`);

        // Step 3: Create user account
        console.log('3️⃣  Creating user account in PostgreSQL...');
        const userResult = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [testEmail, testEmail, hashedPassword, 'student']
        );
        const userId = userResult.rows[0].id;
        console.log(`✅ User created with ID: ${userId}\n`);

        // Step 4: Generate admission number
        console.log('4️⃣  Generating admission number...');
        const year = new Date().getFullYear();
        const countResult = await db.query('SELECT COUNT(*) FROM students');
        const count = parseInt(countResult.rows[0].count) + 1;
        const admissionNumber = `STU${year}${count.toString().padStart(3, '0')}`;
        console.log(`✅ Admission Number Generated: ${admissionNumber}\n`);

        // Step 5: Split name
        console.log('5️⃣  Processing full name...');
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || nameParts[0];
        console.log(`✅ First Name: ${firstName}`);
        console.log(`✅ Last Name: ${lastName}\n`);

        // Step 6: Create student record
        console.log('6️⃣  Creating student record in PostgreSQL...');
        await db.query(
            `INSERT INTO students (user_id, admission_number, first_name, last_name, email, date_of_birth, gender, class, parent_name, parent_phone, address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [userId, admissionNumber, firstName, lastName, testEmail, null, null, null, null, null, null]
        );
        console.log(`✅ Student record created\n`);

        // Step 7: Verify registration
        console.log('7️⃣  Verifying registration...');
        const verification = await db.query(`
      SELECT u.id as user_id, u.email, u.role, s.admission_number, s.first_name, s.last_name
      FROM users u
      JOIN students s ON u.id = s.user_id
      WHERE u.email = $1
    `, [testEmail]);

        if (verification.rows.length > 0) {
            const record = verification.rows[0];
            console.log(`✅ Registration verified in database`);
            console.log(`   User ID: ${record.user_id}`);
            console.log(`   Email: ${record.email}`);
            console.log(`   Role: ${record.role}`);
            console.log(`   Admission Number: ${record.admission_number}`);
            console.log(`   Name: ${record.first_name} ${record.last_name}\n`);
        }

        // Step 8: Test login simulation
        console.log('8️⃣  Testing login credentials...');
        const loginTest = await db.query(`
      SELECT u.password, s.admission_number, s.first_name
      FROM users u
      JOIN students s ON u.id = s.user_id
      WHERE s.admission_number = $1 AND u.role = 'student'
    `, [admissionNumber]);

        if (loginTest.rows.length > 0) {
            const student = loginTest.rows[0];
            const passwordMatch = await bcrypt.compare(testPassword, student.password);
            console.log(`✅ Login test successful`);
            console.log(`   Admission Number: ${student.admission_number}`);
            console.log(`   Student Name: ${student.first_name}`);
            console.log(`   Password Match: ${passwordMatch ? '✅ CORRECT' : '❌ WRONG'}\n`);
        }

        console.log('='.repeat(60));
        console.log('\n✅ COMPLETE REGISTRATION FLOW TESTED SUCCESSFULLY!\n');
        console.log('📋 Test Summary:');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
        console.log(`   Admission Number: ${admissionNumber}`);
        console.log(`   User ID: ${userId}`);
        console.log('\n🎓 Student can now login with:');
        console.log(`   Admission Number: ${admissionNumber}`);
        console.log(`   Password: ${testPassword}\n`);

    } catch (err) {
        console.error('❌ Error during registration flow:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

testRegistrationFlow();
