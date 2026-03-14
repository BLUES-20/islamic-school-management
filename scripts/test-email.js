require('dotenv').config();

const {
    sendEmail,
    getEmailStatus
} = require('../services/email');

async function main() {
    const to = process.env.TEST_EMAIL_TO;
    if (!to) {
        console.error('Missing TEST_EMAIL_TO (set it in your environment)');
        process.exit(2);
    }

    const status = getEmailStatus();
    console.log('Email status:', status);

    const ok = await sendEmail(
        to,
        'Test Email - Islamic School Management',
        '<p>This is a test email from your app.</p>'
    );

    if (!ok) {
        console.error('Email failed to send. Check your EMAIL_PROVIDER and credentials.');
        process.exit(1);
    }

    console.log('Email sent successfully.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

