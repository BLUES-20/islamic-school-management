require('dotenv').config();
const { sendEmail } = require('../services/email');
const path = require('path');
const ejs = require('ejs');

/**
 * Test Registration Receipt Email Preview
 * Run: node scripts/test-registration-email.js
 */

async function testReceiptEmail() {
    console.log('🧪 Testing Registration Receipt Email...\n');

    const testData = {
        student: {
            full_name: 'Ahmad Ibn Yusuf',
            admission_number: 'STU2024A001',
            class_name: 'JSS2'
        },
        payment: {
            amount: 2000,
            currency: 'NGN',
            tx_ref: 'REG-abc123-1721746500176',
            flw_transaction_id: 'flw_tx_123456789'
        }
    };

    const receiptNumber = `REC-${testData.payment.tx_ref}-2024`;
    const receiptDate = new Date().toLocaleDateString('en-NG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const templateData = {
        receiptNumber,
        receiptDate,
        ...testData,
        currency: testData.payment.currency,
        amount: testData.payment.amount,
        tx_ref: testData.payment.tx_ref,
        flw_transaction_id: testData.payment.flw_transaction_id || 'N/A',
        class_name: testData.student.class_name || 'Not assigned'
    };

    try {
        // Render template
        const templatePath = path.join(__dirname, '../views/emails/payment-receipt.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        // Email config
        const testEmail = process.env.TEST_EMAIL_TO || 'your-test-email@example.com';
        const subject = `Payment Receipt ${receiptNumber} - ${testData.student.admission_number}`;

        console.log('📧 Sending test receipt to:', testEmail);
        console.log('📄 Subject:', subject);
        console.log('✅ Template rendered successfully');
        console.log('\n📱 Preview (first 500 chars):\n', html.substring(0, 500) + '...');
        console.log('\n---');

        const sent = await sendEmail(testEmail, subject, html);

        if (sent) {
            console.log('\n🎉 RECEIPT EMAIL SENT SUCCESSFULLY!');
            console.log('📧 Check your inbox/spam:', testEmail);
        } else {
            console.log('\n❌ Email send failed - check your email config');
        }

        return sent;
    } catch (error) {
        console.error('💥 Error:', error.message);
        return false;
    }
}

testReceiptEmail();
