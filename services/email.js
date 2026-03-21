const nodemailer = require('nodemailer');
const { Resend } = require('resend');

function normalizeEmailList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
}

function getFrom() {
    const fromName = process.env.EMAIL_FROM_NAME || 'Islamic School';
    const fromAddress =
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        // Resend supports this for testing; in production you should set EMAIL_FROM to a verified sender/domain.
        'onboarding@resend.dev';

    return `${fromName} <${fromAddress}>`;
}

function detectProvider() {
    const forced = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    if (forced) return forced;

    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.SMTP_HOST) return 'smtp';
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'gmail';

    return 'none';
}

function getStatus() {
    const provider = detectProvider();
    if (provider === 'resend') {
        return {
            provider,
            configured: !!process.env.RESEND_API_KEY
        };
    }

    if (provider === 'smtp') {
        return {
            provider,
            configured: !!process.env.SMTP_HOST
        };
    }

    if (provider === 'gmail') {
        return {
            provider,
            configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
        };
    }

    return {
        provider: 'none',
        configured: false
    };
}

let cachedTransport = null;
function getNodemailerTransport(provider) {
    if (cachedTransport) return cachedTransport;

    if (provider === 'smtp') {
        const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
        const secure =
            typeof process.env.SMTP_SECURE === 'string'
                ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
                : port === 465;

        cachedTransport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure,
            auth: process.env.SMTP_USER
                ? {
                      user: process.env.SMTP_USER,
                      pass: process.env.SMTP_PASS
                  }
                : undefined
        });
        return cachedTransport;
    }

    // Default to Gmail if credentials exist
    cachedTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    return cachedTransport;
}

let cachedResend = null;
function getResendClient() {
    if (cachedResend) return cachedResend;
    cachedResend = new Resend(process.env.RESEND_API_KEY);
    return cachedResend;
}

async function sendEmail(to, subject, html, options = {}) {
    const status = getStatus();

    console.log(`📧 Email Request: provider="${status.provider}", configured=${status.configured}, to="${to}", subject="${subject}"`);

    if (!status.configured) {
        console.error(`❌ EMAIL NOT CONFIGURED - Provider: ${status.provider}`);
        console.error(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✓ set to: ' + process.env.EMAIL_USER : '✗ missing'}`);
        console.error(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✓ set (hidden)' : '✗ missing'}`);
        console.error(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✓ set (hidden)' : '✗ missing'}`);
        console.error(`   SMTP_HOST: ${process.env.SMTP_HOST ? '✓ set to: ' + process.env.SMTP_HOST : '✗ missing'}`);
        return false;
    }

    const toList = normalizeEmailList(to);
    if (toList.length === 0) {
        console.error(`❌ No valid recipients. Original: ${to}`);
        return false;
    }

    const replyToList = normalizeEmailList(options.replyTo);
    const from = options.from || getFrom();

    console.log(`📤 Sending email via ${status.provider} to ${toList.join(', ')}`);

    // 🔧 Gmail fallback for Resend (gmail.com not verified on Resend)
    const isGmailRecipient = toList.some(email => email.toLowerCase().endsWith('@gmail.com'));
    const useResend = status.provider === 'resend' && !isGmailRecipient;
    
    console.log(isGmailRecipient ? '🔄 Gmail recipient → Using Gmail/Nodemailer fallback' : `📤 Using ${status.provider}`);

    try {
        if (useResend) {
            console.log('   Using Resend API...');
            const resend = getResendClient();
            const { data, error } = await resend.emails.send({
                from,
                to: toList,
                subject,
                html,
                reply_to: replyToList.length ? replyToList : undefined
            });

            if (error) {
                console.error(`❌ Resend API error: ${error.message}`);
                throw new Error(error.message || 'Resend email error');
            }

            console.log(`✅ Email sent via Resend to ${toList.join(', ')} ID: ${data.id}`);
            return true;
        } else {
            console.log(`   Using ${status.provider === 'gmail' ? 'Gmail/Nodemailer' : 'SMTP'} transport...`);
            const transport = getNodemailerTransport(status.provider);
            
            console.log(`   Transport config: ${status.provider === 'gmail' ? 'Gmail service' : 'SMTP host: ' + process.env.SMTP_HOST}`);
            console.log(`   From: ${from}`);
            console.log(`   To: ${toList.join(', ')}`);
            console.log(`   Subject: ${subject}`);
            
            const mailOptions = {
                from,
                to: toList.join(', '),
                subject,
                html,
                replyTo: replyToList.length ? replyToList.join(', ') : undefined
            };

            console.log(`📬 Attempting to send via ${status.provider}...`);
            const info = await transport.sendMail(mailOptions);
            
            console.log(`✅ Email successfully sent via ${status.provider}`);
            console.log(`   Message ID: ${info.messageId || 'N/A'}`);
            console.log(`   Response: ${info.response || 'OK'}`);
            return true;
        }
    } catch (err) {
        console.error(`❌ CRITICAL Email sending error:`, err.message);
        console.error(`   Error code: ${err.code || 'N/A'}`);
        console.error(`   Error response: ${err.response || 'N/A'}`);
        console.error(`   Full error:`, err);
        return false;
    }
}

module.exports = {
    sendEmail,
    getEmailStatus: getStatus
};

