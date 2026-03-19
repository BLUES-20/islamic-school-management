require('dotenv').config();

const APP_URL = process.env.APP_URL || 'https://islamic-school.onrender.com';
const TEST_TOKEN = 'abc123-test-token';
const RESET_URL = `${APP_URL}/auth/reset-password/${TEST_TOKEN}`;

console.log('🔗 HTTPS Reset Link Test\n');
console.log('APP_URL:', APP_URL);
console.log('Full Reset Link:', RESET_URL);
console.log('\n📱 MOBILE TEST:');
console.log('1. Copy link above');
console.log('2. Open on phone browser');
console.log('3. Should load reset-password page');
console.log('\n✅ Ready for production HTTPS!');

