# 🔗 HTTPS RESET LINKS - Force HTTPS (No localhost)

**Problem**: Still shows localhost - needs **HTTPS only**.

**NO CODE CHANGE** - `.env` + fallback function.

## 1. .env (MANDATORY)
```
APP_URL=https://your-domain.com
```
**Local HTTPS dev**:
```
APP_URL=https://localhost:3000
```

## 2. Test HTTPS Links (NEW script)
```
node scripts/test-https-reset.js
```
Generates **HTTPS reset link** preview.

## 3. Universal HTTPS Fallback (Optional .env)
```
FORCE_HTTPS=1
```
Auto-converts `http://localhost` → `https://your-domain`.

## 4. Deploy HTTPS:
```
# Render/Vercel/Heroku = auto HTTPS
# Local: APP_URL=https://192.168.1.100:3000 (HTTPS tunnel)
```

**Verify**:
1. `APP_URL=https://test.com`
2. Forgot password → email link: `https://test.com/auth/reset-password/xxx`
3. **Works on phone** - no localhost!

**Restart**: `node server.js`

**Production HTTPS Ready** 📱
