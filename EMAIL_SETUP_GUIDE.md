# 📧 Email Configuration Guide

## Problem Summary
Students were not receiving admission numbers via email after completing registration and payment. The code was correct, but the email provider was not configured on the Render deployment.

## Solution Implemented

### 1. **Email Retry Logic** ✅
The payment callback now:
- Attempts to send email up to 3 times with 2-second delays between retries
- Provides detailed logging at each attempt
- Sends admin notification emails when payment is successful
- Logs email status to server console for monitoring

### 2. **Email Resend Endpoint** ✅
New endpoint available for manual resend:
```
POST /auth/resend-admission
Body: {
  "email": "student@example.com",
  "admission_number": "STU2026001"
}
```
Returns: Success/failure JSON with student details

### 3. **Email Provider Priority** 📋

The system checks for email providers in this order:

#### **Option 1: Resend API (Recommended for Render)**
**Setup:**
1. Go to [resend.com](https://resend.com) and create account
2. Create API key
3. In Render environment variables, add:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   ```
**Pros:** 
- Easiest to set up on Render
- Reliable delivery
- Free tier available
- Best for production

#### **Option 2: Gmail / SMTP (Google Account)**
**Setup:**
1. Enable 2-Factor Authentication on Gmail account
2. Generate App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. In Render environment variables, add:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```
**Pros:** No external signup needed
**Cons:** May have delivery issues with transactional emails

#### **Option 3: Custom SMTP Server**
**Setup:**
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_SECURE=false
```

## How to Configure on Render

### Step-by-Step for Resend API (Recommended):

1. **Get API Key:**
   - Go to https://resend.com
   - Sign up for free account
   - Go to Dashboard → API Keys
   - Click "Create API Key"
   - Copy the key (starts with `re_`)

2. **Add to Render:**
   - Go to your Render app dashboard
   - Click "Environment"
   - Click "Add Environment Variable"
   - Name: `RESEND_API_KEY`
   - Value: `re_xxxxxxxxxxxxxxxxxxxx` (paste the key you copied)
   - Click "Save Changes"

3. **Restart App:**
   - Click "Manual Deploy" or wait for auto-deploy
   - Watch the logs to confirm it deploys

4. **Test:**
   - Go to your Render app URL
   - Try registering a student with a real email
   - Complete payment process
   - Check email for admission number

### Step-by-Step for Gmail:

1. **Enable 2FA on Gmail:**
   - Go to myaccount.google.com
   - Click "Security" in left menu
   - Scroll to "How you sign in to Google"
   - Enable "2-Step Verification"

2. **Create App Password:**
   - Go to myaccount.google.com → Security
   - Scroll to "App passwords" (appears after 2FA enabled)
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password
   - It looks like: `xxxx xxxx xxxx xxxx`

3. **Add to Render:**
   - Environment variable 1:
     ```
     EMAIL_USER=your.email@gmail.com
     ```
   - Environment variable 2:
     ```
     EMAIL_PASS=xxxx xxxx xxxx xxxx
     ```

## Testing Email Configuration

### Method 1: Using Test Endpoint
```
GET /auth/test-email/your-email@gmail.com
```
This endpoint:
- Checks if email provider is configured
- Sends a test email
- Returns JSON with results
- Shows which variables are set

### Method 2: Manual Registration
1. Go to `/auth/student-register`
2. Fill out registration form
3. Check console logs during payment callback
4. Look for these messages:
   ```
   ✅ SUCCESS: Email sent successfully to student@example.com
   ```
   OR
   ```
   ❌ ATTEMPT FAILED: Email service returned false
   ```

### Method 3: Check Render Logs
In Render dashboard:
1. Click "Logs" tab
2. Search for "EMAIL" to see all email-related messages
3. Look for:
   - `📧 Email Request:` - shows email attempted
   - `✅ Email sent via` - success
   - `❌ EMAIL NOT CONFIGURED` - missing config
   - `❌ ATTEMPT FAILED` - retry attempt failed

## Troubleshooting

### Email Not Received

**Check 1: Environment Variables Set?**
```
Logs will show:
EMAIL_USER: ✗ MISSING
EMAIL_PASS: ✗ MISSING  
RESEND_API_KEY: ✗ MISSING
```
→ Add the variables in Render and restart

**Check 2: Test Endpoint**
```
GET /auth/test-email/your-email@gmail.com
```
→ Look for success/failure message

**Check 3: Check Spam Folder**
Gmail might filter admission emails as spam initially.
→ Mark as "Not Spam" to train filter

**Check 4: Render Logs**
Search logs for `❌ EMAIL NOT CONFIGURED`
→ Indicates no provider is set up

**Check 5: Manual Resend**
```
POST /auth/resend-admission
{
  "email": "student@example.com",
  "admission_number": "STU2026001"
}
```
→ If this works, original email config is fine

### Gmail App Password Issues

**"Invalid credentials" error:**
- Make sure 2FA is enabled FIRST
- Generate new app password (the 16-char one)
- Don't use your regular Gmail password
- Don't include spaces when copying the password

**Still getting errors:**
- Try Resend API instead (recommended)
- Or use a dedicated service account

## Email Flow Diagram

```
Student Registration Form
    ↓
POST /student-register
    ↓
Create user/student in DB
Generate admission number (STU2026###)
Store in session.pendingRegistration
    ↓
Redirect to /registration-payment
    ↓
Display Flutterwave payment form
    ↓
User completes payment
Flutterwave redirects to /payment-callback
    ↓
GET /payment-callback?status=successful
    ↓
Record payment in DB
Store success in session
    ↓
🔄 SEND EMAIL (WITH RETRY × 3)
    ↓
Attempt 1: sendEmail(student@example.com, admission_html)
  ✓ Success? → Return true ✅
  ✗ Fail? → Wait 2 sec → Attempt 2
    ↓
Attempt 2: sendEmail() retry
  ✓ Success? → Return true ✅
  ✗ Fail? → Wait 2 sec → Attempt 3
    ↓
Attempt 3: Final attempt
  ✓ Success? → Return true ✅
  ✗ Fail? → Log error, continue
    ↓
Redirect to /payment-success (immediate)
    ↓
Display success page with admission number
(Email continues sending in background)
    ↓
Email arrives (or logged as failed after 3 retries)
```

## API Endpoints Related to Email

### Resend Admission Email
```
POST /auth/resend-admission
Body: {
  "email": "student@example.com",
  "admission_number": "STU2026001"
}
Response: {
  "success": true,
  "message": "Admission email resent successfully to student@example.com",
  "student": {
    "name": "Student Name",
    "admission_number": "STU2026001",
    "email": "student@example.com",
    "class": "Class 1"
  }
}
```

### Test Email
```
GET /auth/test-email/your-email@gmail.com
Response: {
  "success": true/false,
  "message": "Test email sent successfully / Test email failed",
  "testEmail": "your-email@gmail.com",
  "config": {
    "EMAIL_USER": "✓ configured or ✗ missing",
    "EMAIL_PASS": "✓ configured or ✗ missing",
    "RESEND_API_KEY": "✓ configured or ✗ missing",
    "SMTP_HOST": "✓ configured or ✗ missing"
  }
}
```

## Monitoring & Logs

### What to look for in logs:

✅ **Success indicators:**
```
📧 Email Request: provider="resend", configured=true, to="student@example.com"
📤 Sending email via resend to student@example.com
✅ Email sent via Resend to student@example.com
```

❌ **Failure indicators:**
```
❌ EMAIL NOT CONFIGURED - Provider: none
   EMAIL_USER: ✗ missing
   EMAIL_PASS: ✗ missing
   RESEND_API_KEY: ✗ missing
```

🔄 **Retry indicators:**
```
EMAIL SEND ATTEMPT 1/3
⏰ Waiting before retry...
EMAIL SEND ATTEMPT 2/3
```

## Quick Checklist

- [ ] Choose email provider (Recommended: Resend)
- [ ] Create account and get API key / app password
- [ ] Add environment variable(s) to Render
- [ ] Restart Render app
- [ ] Test with `/auth/test-email/test@gmail.com`
- [ ] Do full registration test
- [ ] Check student email for admission number
- [ ] Monitor logs for any errors
- [ ] Save this guide for reference

## Support

If emails still don't work:
1. Check environment variables are set (exact spelling)
2. Check Render logs for error messages
3. Try test endpoint first
4. Try manual resend endpoint
5. Switch to different email provider
6. Contact email provider support if needed

---
**Last Updated:** After implementing email retry logic and resend endpoint
**Status:** Ready for deployment to Render
