# Deploy to Supabase (Database) + Render (Frontend)

This guide shows how to deploy your app using:
- **Supabase**: PostgreSQL Database
- **Render**: Frontend hosting (your EJS templates)

---

## Option 1: Use Supabase PostgreSQL Only (Easiest)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: `islamic-school`
   - **Database Password**: (remember this!)
   - **Region**: Singapore (closest to you)
4. Click "Create new project"
5. Wait 2-3 minutes for setup

### Step 2: Get Supabase Connection String
1. In Supabase dashboard, go to **Settings** → **Database**
2. Find **Connection String** section
3. Copy the **URI** (looks like: `postgres://postgres:[password]@db.xxxx.supabase.co:5432/postgres`)
4. Replace `[password]` with your actual database password


### Step 3: Push Code to GitHub
```bash
cd islamic-school-management
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/islamic-school.git
git push -u origin main
```

### Step 4: Deploy to Render
1. Go to https://render.com
2. Create **New PostgreSQL** (or use Supabase from Step 2)
3. Create **New Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Name**: `islamic-school`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add Environment Variables:

| Variable | Value |
|---------|-------|
| `DATABASE_URL` | Supabase connection string (from Step 2) |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Random string (generate one) |
| `EMAIL_USER` | Your Gmail |
| `EMAIL_PASS` | Your Gmail App Password |

7. Deploy!

---

## Option 2: Use Full Supabase (Database + Auth)

This requires code changes to use Supabase Auth instead of sessions.

### Step 1: Enable Supabase Auth
1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Email** provider

### Step 2: Update Environment Variables
Add these to your `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Step 3: Update Auth Code
(Requires modifying routes/auth.js to use Supabase Auth)

---

## Your Frontend Files ARE Ready!

Your EJS templates are already the frontend:
- `views/index.ejs` - Home page
- `views/auth/student-login.ejs` - Student login
- `views/auth/student-register.ejs` - Registration
- `views/staff/dashboard.ejs` - Staff dashboard
- `views/student/profile.ejs` - Student profile
- etc.

These render server-side and are served by Express on Render.

---

## Quick Deploy Checklist

- [ ] Supabase project created
- [ ] Database schema ready (auto-created on first run)
- [ ] Code pushed to GitHub
- [ ] Render web service created
- [ ] Environment variables added
- [ ] Deployed and tested

---

## Default Credentials After Deploy

- **Admin Email**: admin@school.com
- **Admin Password**: admin123
