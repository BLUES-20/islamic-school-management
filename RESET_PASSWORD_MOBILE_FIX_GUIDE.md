# 📱 RESET PASSWORD MOBILE FIX (No localhost links)

**Problem**: Reset links show `localhost:3000` → won't work on phone.

**Solution**: 1-line `.env` fix + test script.

## 1. Set APP_URL (.env file)
```
APP_URL=https://your-domain.com
```
**Examples**:
```
APP_URL=https://islamic-school.onrender.com     # Render
APP_URL=https://your-app.vercel.app             # Vercel  
APP_URL=http://192.168.1.100:3000               # Local network (replace IP)
APP_URL=https://your-ip.ngrok.io                 # ngrok tunnel
```

**Local network** (phone + PC same WiFi):
```
# Run on PC: ipconfig (Windows) / ifconfig (Mac)
APP_URL=http://192.168.1.100:3000  # Your PC IP
```

## 2. Test Reset Link (NEW script)
```
node scripts/test-password-reset.js
```
Sends test reset to your email - opens on **phone/mobile**.

## 3. Restart
```
node server.js
```

## 4. Verify
1. Forgot password → email → **link works on phone**
2. Reset page → new password → login OK

**Code change**: Uses `process.env.APP_URL` - fallback `http://host` only if missing.

**ngrok Quick Fix** (free tunnel):
```
npm i -g ngrok
ngrok http 3000
```
`.env`: `APP_URL=https://abc123.ngrok.io`

**Result**: Reset links work anywhere (phone, SMS preview, etc.)! 📱✨
