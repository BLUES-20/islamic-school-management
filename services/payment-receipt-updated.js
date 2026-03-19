const emailService = require('./email');
const path = require('path');
const ejs = require('ejs');

/**
 * Send formal payment receipt email using EJS template after successful Flutterwave registration payment
 * @param {string} toEmail - Student email
 * @param {Object} student - {full_name, admission_number, class_name}
 * @param {Object} payment - {amount, currency, tx_ref, flw_transaction_id}
 * @returns {Promise<boolean>} - true if sent
 */
async function sendPaymentReceipt(toEmail, student, payment) {
    const receiptNumber = `REC-${payment.tx_ref}-${new Date().getFullYear()}`;
    const receiptDate = new Date().toLocaleDateString('en-NG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const templateData = {
        receiptNumber,
        receiptDate,
        student,
        payment,
        currency: payment.currency || 'NGN',
        amount: payment.amount,
        tx_ref: payment.tx_ref,
        flw_transaction_id: payment.flw_transaction_id || 'N/A',
        class_name: student.class_name || 'Not assigned'
    };

    try {
        // Render EJS template
        const templatePath = path.join(__dirname, '../views/emails/payment-receipt.ejs');
        const html = await ejs.renderFile(templatePath, templateData);

        const subject = `Payment Receipt ${receiptNumber} - ${student.admission_number} | Islamic School`;
        
        // Use existing email service
        return await emailService.sendEmail(toEmail, subject, html);
    } catch (error) {
        console.error('Receipt email render/send error:', error);
        return false;
    }
}

module.exports = { sendPaymentReceipt };
