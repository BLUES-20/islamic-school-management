# 🔧 FIX REGISTRATION EMAILS - No Admission Until Payment

**Changes needed** (copy-paste snippets - NO logic change):

## 1. Remove "Skip & Login Later" Button
**File**: `views/auth/registration-payment.ejs`

**Find & DELETE** (line ~170):
```html
<a href="/auth/student-login" class="btn-skip">
    <i class="fas fa-arrow-right me-1"></i> Skip & Login Later (Payment Required)
</a>
```

**Result**: No skip button - payment mandatory.

## 2. Stop Admission Email Before Payment
**File**: `routes/auth.js` (student-register POST)

**Find** (around line 250):
```javascript
// Send welcome email to the student
const studentHtml = `...`;
await sendEmail(email, `Your Admission Number - ${admission_number}`, studentHtml);
```

**COMMENT OUT or DELETE** both lines:
```javascript
// await sendEmail(email, `Your Admission Number - ${admission_number}`, studentHtml);  // REMOVED - no email before payment
```

**Keep admin email** (for tracking):
```javascript
if (adminEmail) {
    await sendEmail(adminEmail, `New Student Registration - ${admission_number}`, adminHtml);
}
```

## 3. Current Flow After Fix:
1. Register → student created (pending)
2. **NO email sent** (no admission number leaked)
3. Payment → verify → **THEN** receipt email WITH admission number
4. Login with admission# + password

## 4. Restart & Test
```bash
node server.js
```
Register → payment page → **no skip** → pay → receipt w/ admission → login.

**Security**: Admission# only revealed after successful payment! 🔒
