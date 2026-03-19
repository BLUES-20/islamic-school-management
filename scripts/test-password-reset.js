require('dotenv').config();
const axios = require('axios');
const { sendEmail } = require('../services/email');

async function testPasswordReset() {
    console.log('🔐 Testing Password Reset Flow...\n');
    
    const testEmail = process.env.TEST_EMAIL_TO || 'test@example.com';
    console.log('📧 Test email:', testEmail);
    
    // 1. Trigger forgot password (to your server)
    const baseUrl = process.env.APP_URL || `http://localhost:3000`;
    const forgotUrl = `${baseUrl}/auth/forgot-password`;
    
    console.log('🌐 APP_URL:', baseUrl);
    console.log('🔗 Forgot URL:', forgotUrl, '\n---');
    
    try {
        // Simulate forgot password POST
        const forgotResponse = await axios.post(forgotUrl, `email=${encodeURIComponent(testEmail)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        console.log('✅ Forgot password triggered');
        
        // 2. Check token in DB (manual check)
        console.log('\n📋 MANUAL CHECK:');
        console.log('Run SQL: SELECT reset_password_token, reset_password_expires FROM users WHERE email = \'' + testEmail + '\'');
        console.log('\n📧 Check email for reset link - should be:', `${baseUrl}/auth/reset-password/[TOKEN]`);  
        
        // 3. Test email service
        const testResetHtml = `
            <h2>Password Reset Test</h2>
            <p>APP_URL: <strong>${baseUrl}</strong></p>
            <p>Test link: <a href="${baseUrl}/auth/reset-password/test123">Reset Password</a></p>
            <p>✅ Email config OK if you see this!</p>
        `;
        
        const sent = await sendEmail(testEmail, 'Password Reset Test - Link Works', testResetHtml);
        console.log('\n📨 Test reset email:', sent ? '✅ SENT' : '❌ FAILED');
        
    } catch (error) {
        console.error('💥 Error:', error.response?.data || error.message);
    }
}

testPasswordReset();
