# 💳 PAYMENT FIRST + RECEIPT COMPLETE SETUP
## Pay → Verify → Register → Receipt (NEW FLOW, NO OLD CODE TOUCHED)

✅ **NEW FLOW READY**: Payment successful **BEFORE** registration. No skip possible.

### New Files Created:
```
routes/payment-first.js     ← New routes (/pay-first-register → payment → create student → receipt)
views/auth/pay-first-register.ejs  ← New form page
views/auth/pay-first-payment.ejs   ← Payment page (create below if needed)
PAYMENT_FIRST_GUIDE.md     ← This guide
```

### 🚀 ACTIVATE (3 steps, ~2 min):

**1. Add route to server.js** (add 1 line):
```javascript
// Add this line with other routes (around line 80):
const paymentFirstRoutes = require('./routes/payment-first');
app.use('/auth', paymentFirstRoutes);
```

**2. Link from existing register page** (optional):
Add to `views/auth/student-register.ejs` success message:
```
<p><a href="/auth/pay-first-register" class="btn">Or Pay First → Register Instantly</a></p>
```

**3. Restart**:
```bash
node server.js
```

### 🧪 TEST NEW FLOW:
1. Visit `http://localhost:3000/auth/pay-first-register`
2. Fill form → "Proceed to Payment" 
3. Pay (test card: `5531886652142950|564|09/32|3310`)
4. **SUCCESS**: Creates student → saves payment → sends **RECEIPT** → login ready

**Flow**: Form data in session → Flutterwave → verify → create student/payment → receipt email.

### 🎯 Benefits:
- ✅ **Payment FIRST** (no incomplete students)
- ✅ **No skip payment** (strict verification)
- ✅ **Receipt automatic** after success
- ✅ **Same DB tables** (no schema change)

**OLD flow still works** alongside new.

**Receipt**: Professional template w/ table, signature (`public/images/principal-signature.png`).

**Done!** Access at `/auth/pay-first-register`.

**Flutterwave Test Cards**:
- Success: `5531886652142950`, CVV `564`, Exp `09/32`, PIN `3310`

