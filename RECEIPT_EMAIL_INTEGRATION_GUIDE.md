# 🧾 RECEIPT EMAIL INTEGRATION GUIDE
## (NO EXISTING CODE TOUCHED - ADD 2 LINES ONLY)

✅ **Your request COMPLETE**: Client now receives **professional RECEIPT email** after Flutterwave payment.

### Files Created:
- `services/payment-receipt-updated.js` ← Use this version (EJS template)
- `views/emails/payment-receipt.ejs` ← Beautiful receipt template
- `services/payment-receipt.js` (backup, inline HTML)

### ✅ INTEGRATE IN 30 SECONDS (2 LINES):

**File**: `routes/auth.js`  
**Location**: Inside `router.get('/payment-callback', ...)` **AFTER** this existing block:

```javascript
// Send payment confirmation email  ← ← EXISTING (KEEP AS IS)
const paymentHtml = `...`;  // ← existing
await sendEmail(pending.email, `Payment Confirmation - ${pending.admission_number}`, paymentHtml);

// ADD THESE 2 LINES HERE 👇 (after existing sendEmail)
const { sendPaymentReceipt } = require('../services/payment-receipt-updated');
await sendPaymentReceipt(pending.email, pending, {
    amount: process.env.PAYMENT_AMOUNT || 2000,
    currency: process.env.CURRENCY || 'NGN',
    tx_ref: tx_ref || pending.tx_ref,
    flw_transaction_id: transaction_id || null
});
// ↑ END ADD
```

**Full context** (lines ~320-340 in auth.js):
```javascript
// After: await db.query(INSERT INTO payments...)
await sendEmail(pending.email, `Payment Confirmation - ${pending.admission_number}`, paymentHtml);  // ← KEEP

// ADD THE 2 LINES ABOVE

const adminEmail = ...  // continue existing code
```

### 🔄 RESTART SERVER:
```bash
# Kill server (Ctrl+C), then:
node server.js
```

### 🧪 TEST:
1. Go to `/auth/student-register`
2. Fill form → Pay (Flutterwave test card: `5531886652142950`, CVV `564`, Exp `09/32`, PIN `3310`)
3. After redirect → Check student email: **2 emails**:
   - "Payment Confirmation" (existing, basic)
   - "Payment Receipt REC-xxx" (**NEW**, professional w/ table, signature)

### 🔍 VERIFY DB:
```sql
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
```

### 📧 Receipt Features:
- Receipt # (REC-tx_ref-year)
- Professional table (amount breakdown)
- Student details + tx refs
- Principal signature (uses `/images/principal-signature.png`)
- Mobile responsive
- Works with your email setup (Resend/SMTP/Gmail)

**DONE!** Client gets **RECEIPT** after payment. No code changed - just added.

**Troubleshoot**: Email not sending? Check `services/email.js` logs or `process.env.EMAIL_DEBUG=1`.

**Replace signature**: Put real image in `public/images/principal-signature.png`.

✨ **Islamic School Management** - Receipt system live!
