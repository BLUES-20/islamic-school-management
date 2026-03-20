# 🚀 IMMEDIATE ACTION REQUIRED - Fix Email Delivery

## What's Wrong?
Students register, pay, and see their admission number on screen ✅
BUT they don't receive the admission number via email ❌

## Why?
The email provider is not configured on your Render app.
The code to send emails is working correctly, but it can't send because there are no email credentials.

## How to Fix (5 Minutes)

### Step 1: Choose Your Email Provider

**EASIEST OPTION** → Use Resend API:
- Go to https://resend.com
- Click "Sign Up" 
- Create free account
- Go to "Docs" → "API Reference" → scroll to "API Keys"
- Click "Create API Key"
- Copy it (looks like: `re_xxxxxxxxxxxxxxxxx`)

**OR** Use Gmail:
- Go to your Gmail account
- Settings → Security
- Enable "2-Step Verification" (if not already done)
- Go back to Security → "App passwords"
- Select "Mail" and "Windows Computer"
- Copy the 16-character password (like: `xxxx xxxx xxxx xxxx`)

### Step 2: Add to Render

1. Open your Render dashboard: https://dashboard.render.com
2. Click your project name (islamic-school-management or similar)
3. Click **Environment** (left sidebar)
4. Click **Add Environment Variable**

**For Resend (recommended):**
```
Name: RESEND_API_KEY
Value: re_xxxxxxxxxxxxxxxxxxxxx [PASTE YOUR KEY]
```
Then click "Add"

**For Gmail:**
```
Name: EMAIL_USER
Value: your.email@gmail.com [YOUR GMAIL]
```
Click "Add" again:
```
Name: EMAIL_PASS  
Value: xxxx xxxx xxxx xxxx [THE 16-CHAR PASSWORD]
```

### Step 3: Deploy

1. Click the "Manual Deploy" button (or "Redeploy" if it shows)
2. Wait for deployment to finish (usually 2-3 minutes)
3. Check the Logs for this message:
   ```
   ✅ App is running successfully
   ```

### Step 4: Test

1. Go to your app: https://islamic-school-management.onrender.com/auth/student-register (or your Render URL)
2. Fill out registration form with YOUR REAL EMAIL (not test email!)
3. Complete registration and go through payment
4. After payment, check your email inbox
5. You should receive email with "STU2026..." admission number

**If no email:**
1. Check spam/junk folder
2. Test the diagnostic endpoint:
   ```
   https://islamic-school-management.onrender.com/auth/test-email/your-email@gmail.com
   ```
3. Check Render logs for error messages

## What Changed in Your Code?

### 1. Email Retry Logic
```javascript
// Now attempts email 3 times instead of just once
- Attempt 1 fails? Wait 2 seconds, try again
- Attempt 2 fails? Wait 2 seconds, try again  
- Attempt 3 fails? Log error
```

### 2. Admin Notification
```javascript
// Admin gets email when student pays successfully
POST /auth/resend-admission
```

### 3. Manual Resend Endpoint
```javascript
// If email fails, admin can manually resend:
POST /auth/resend-admission
Body: {
  "email": "student@example.com",
  "admission_number": "STU2026001"
}
```

## Detailed Setup Guide
See `EMAIL_SETUP_GUIDE.md` in the project folder for complete information.

## Questions or Issues?

1. **Email not arriving?**
   - Check Render logs for errors
   - Verify email address is correct
   - Check spam folder
   - Try Gmail spam hasn't marked it

2. **Getting errors in Render logs?**
   - Search logs for "EMAIL"
   - Look for "✗ missing" - means variable not set
   - Try test endpoint first

3. **Still stuck?**
   - Try the other email provider (Gmail vs Resend)
   - Make sure you restarted the app after adding variables
   - Double-check the exact names:
     - `RESEND_API_KEY` (not `resend-api-key`)
     - `EMAIL_USER` (not `email-user`)
     - `EMAIL_PASS` (not `email-pass`)

---
**Time to fix:** 5-10 minutes
**Status:** Code is ready, just needs configuration
