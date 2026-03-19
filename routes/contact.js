const express = require('express');
const router = express.Router();
const db = require('../config/supabase');
const {
    sendEmail
} = require('../services/email');

// GET Contact Page
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us - Islamic School',
        page: 'contact'
    });
});

// POST Contact Form - Save to DB and Send Email
router.post('/contact', async (req, res) => {
    const {
        name,
        email,
        subject,
        message
    } = req.body;

    if (!name || !email || !subject || !message) {
        req.flash('error', 'All fields are required');
        return res.redirect('/contact');
    }

    try {
        // Save message to database
        await db.query(
            `INSERT INTO contact_messages (name, email, subject, message, status) VALUES ($1, $2, $3, $4, 'unread')`,
            [name, email, subject, message]
        );

        // Also send email notification
        try {
            const inbox = process.env.ADMIN_EMAIL || process.env.EMAIL_INBOX || process.env.EMAIL_USER;
            if (!inbox) {
                throw new Error('No admin inbox configured (set ADMIN_EMAIL, EMAIL_INBOX, or EMAIL_USER)');
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: inbox,
                replyTo: email,
                subject: `New Contact Message: ${subject}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background-color: #1a5f3f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                            <h2 style="margin: 0;">📬 New Contact Form Message</h2>
                            <p style="margin: 5px 0 0 0;">Islamic School Management System</p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
                            <h3>Contact Details:</h3>
                            <p><strong>Name:</strong> ${name}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Subject:</strong> ${subject}</p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            
                            <h3>Message:</h3>
                            <div style="background-color: #fff; padding: 15px; border-left: 4px solid #1a5f3f; border-radius: 3px;">
                                <p style="margin: 0; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
                            </div>
                            <p style="margin-top: 20px; color: #666; font-size: 0.9em;">View this message in your <a href="${process.env.APP_URL || 'http://localhost:3000'}/staff/contact-messages">Staff Portal</a></p>
                        </div>
                    </div>
                `
            };

            await sendEmail(mailOptions.to, mailOptions.subject, mailOptions.html, {
                replyTo: mailOptions.replyTo,
                from: mailOptions.from
            });
        } catch (emailErr) {
            // Email failed, but message was saved to DB - that's ok
            console.error('Email notification failed:', emailErr.message);
        }

        req.flash('success', 'Message sent successfully! We will get back to you soon.');
        res.redirect('/contact');

    } catch (err) {
        console.error('Contact form error:', err);
        req.flash('error', 'Error sending message. Please try again later.');
        res.redirect('/contact');
    }
});

module.exports = router;
