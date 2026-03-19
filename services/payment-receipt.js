const emailService = require('./email');

/**
 * Send formal payment receipt email after successful Flutterwave registration payment
 * @param {string} toEmail - Student email
 * @param {Object} student - {full_name, admission_number, class_name}
 * @param {Object} payment - {amount, currency, tx_ref, flw_transaction_id, date}
 * @returns {Promise<boolean>} - true if sent
 */
async function sendPaymentReceipt(toEmail, student, payment) {
    const receiptNumber = `REC-${payment.tx_ref}-${new Date().getFullYear()}`;
    const receiptDate = new Date().toLocaleDateString('en-NG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment Receipt</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <!-- School Header -->
    <div style="background: linear-gradient(135deg, #1a5f3f 0%, #2d8a5e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Islamic School Management System</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">OFFICIAL PAYMENT RECEIPT</p>
        <p style="margin: 10px 0 0 0; font-size: 14px;">Receipt No: <strong>${receiptNumber}</strong></p>
    </div>

    <!-- Receipt Details Table -->
    <div style="background: white; padding: 30px; border: 2px solid #e0e0e0; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
                <h3 style="margin: 0 0 10px 0; color: #1a5f3f;">Student Information</h3>
                <p><strong>Name:</strong> ${student.full_name}</p>
                <p><strong>Admission Number:</strong> ${student.admission_number}</p>
                <p><strong>Class:</strong> ${student.class_name || 'Not assigned'}</p>
            </div>
            <div style="text-align: right;">
                <h3 style="margin: 0 0 10px 0; color: #1a5f3f;">Receipt Date</h3>
                <p style="font-size: 18px; font-weight: bold;">${receiptDate}</p>
            </div>
        </div>

        <h3 style="margin: 30px 0 20px 0; color: #1a5f3f; border-bottom: 3px solid #1a5f3f; padding-bottom: 10px;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold;">Description</td>
                <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold; text-align: right;">Amount</td>
            </tr>
            <tr>
                <td style="padding: 15px; border: 1px solid #ddd;">Registration Fee</td>
                <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #1a5f3f; font-size: 18px;">${payment.currency} ${payment.amount.toLocaleString()}</td>
            </tr>
            <tr style="background: #e8f5e8;">
                <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold;">TOTAL</td>
                <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #1a5f3f; font-size: 20px;">${payment.currency} ${payment.amount.toLocaleString()}</td>
            </tr>
        </table>

        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">Transaction Reference</h4>
            <p style="margin: 0; font-family: monospace; font-size: 14px; word-break: break-all;">
                <strong>Tx Ref:</strong> ${payment.tx_ref}<br>
                <strong>Flutterwave Tx ID:</strong> ${payment.flw_transaction_id || 'N/A'}
            </p>
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 2px dashed #ddd;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                Thank you for your payment. Please keep this receipt for your records.
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">
                You can now login using your Admission Number.
            </p>
            <img src="https://via.placeholder.com/200x80/1a5f3f/ffffff?text=Principal+Signature" alt="Principal Signature" style="max-width: 200px; height: auto;">
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #888; font-style: italic;">
                Principal<br>
                Islamic School
            </p>
        </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 30px; font-size: 12px; color: #666;">
        <p>This is an automated receipt. For inquiries, contact the school office.</p>
        <p>Generated by Islamic School Management System</p>
    </div>
</body>
</html>`;

    const subject = `Payment Receipt ${receiptNumber} - ${student.admission_number}`;
    
    return emailService.sendEmail(toEmail, subject, html);
}

module.exports = { sendPaymentReceipt };
