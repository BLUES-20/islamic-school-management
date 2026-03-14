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

    if (!status.configured) {
        if (process.env.EMAIL_DEBUG === '1') {
            console.log('📧 Email skipped (not configured):', subject);
        }
        return false;
    }

    const toList = normalizeEmailList(to);
    if (toList.length === 0) return false;

    const replyToList = normalizeEmailList(options.replyTo);
    const from = options.from || getFrom();

    try {
        if (status.provider === 'resend') {
            const resend = getResendClient();
            const { error } = await resend.emails.send({
                from,
                to: toList,
                subject,
                html,
                reply_to: replyToList.length ? replyToList : undefined
            });

            if (error) {
                throw new Error(error.message || 'Resend email error');
            }

            if (process.env.EMAIL_DEBUG === '1') {
                console.log(`✅ Email sent via Resend to ${toList.join(', ')}`);
            }
            return true;
        }

        const transport = getNodemailerTransport(status.provider);
        await transport.sendMail({
            from,
            to: toList.join(', '),
            subject,
            html,
            replyTo: replyToList.length ? replyToList.join(', ') : undefined
        });

        if (process.env.EMAIL_DEBUG === '1') {
            console.log(`✅ Email sent via ${status.provider} to ${toList.join(', ')}`);
        }
        return true;
    } catch (err) {
        console.error('Email sending error:', err && err.message ? err.message : err);
        return false;
    }
}

module.exports = {
    sendEmail,
    getEmailStatus: getStatus
};

