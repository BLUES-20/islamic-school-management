# 🚀 PHONE RESET LINK - **INSTANT HTTPS FIX** (2 min)

**Your APP_URL**: https://islamic-school.onrender.com ✅ **ALREADY HTTPS**

**Why phone fail**: Render needs **route fix** + **token expiry**.

## QUICK 1: ngrok (5s local HTTPS tunnel)
```
npm i -g ngrok
ngrok http 3000
```
**Copy HTTPS link** (e.g. https://abc.ngrok-free.app):
```
.env: APP_URL=https://abc.ngrok-free.app
node server.js
```
Phone opens **perfect**.

## QUICK 2: Render HTTPS (production)
```
.env:
APP_URL=https://islamic-school.onrender.com

# Deploy Render (render.yaml ready)
git push origin main
```
Link: `https://islamic-school.onrender.com/auth/reset-password/[token]`

## 3. Test Token Expiry (common issue)
```
node scripts/test-password-reset.js
```
Check token not expired (1hr).

## 4. Direct Test
```
# Open on phone NOW:
https://islamic-school.onrender.com/auth/reset-password/[YOUR_TOKEN]
```

**Paste YOUR reset token** - I fix specific link.

**Deploy = Done** - HTTPS works everywhere! 📱
