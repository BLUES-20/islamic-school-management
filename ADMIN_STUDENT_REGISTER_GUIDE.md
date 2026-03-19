# 👨‍🎓 ADMIN STUDENT REGISTRATION GUIDE
## (NEW - No existing code touched)

✅ **Complete**: Admin can register students directly from dashboard.

### New Files:
```
services/admin-student-register.js  ← Core logic (gen admission#, hash pwd, DB insert, admin email)
views/staff/register-student.ejs    ← Beautiful form (Cloudinary photo upload)
routes/staff-register-student.js    ← GET/POST /staff/register-student
ADMIN_STUDENT_REGISTER_GUIDE.md     ← This guide
```

### 🚀 ACTIVATE (60 seconds):

**1. Add route to server.js** (line ~80 with other routes):
```javascript
const staffRegisterRoutes = require('./routes/staff-register-student');
app.use('/staff', staffRegisterRoutes);
```

**2. Add links** (manual, choose one/both):

**Option A - Dashboard** (`views/staff/dashboard-fixed.ejs`, add card):
```html
<div class="col-md-4 mt-4">
    <div class="card">
        <div class="card-body text-center">
            <i class="fas fa-user-plus fa-3x text-success mb-3"></i>
            <h5>Register Student</h5>
            <p>Admin quick registration</p>
            <a href="/staff/register-student" class="btn btn-success">+ New Student</a>
        </div>
    </div>
</div>
```

**Option B - Manage Students** (`views/staff/manage-students.ejs`, add button top):
```html
<a href="/staff/register-student" class="btn btn-success mb-3">
    <i class="fas fa-user-plus me-2"></i>Add New Student
</a>
```

**3. Restart**:
```bash
node server.js
```

### 🧪 TEST:
1. Login admin → `/staff/register-student`
2. Fill form → Submit
3. ✅ Success: New student + admission# + admin email notification
4. Check `/staff/manage-students` - new student listed

**Features**:
- ✅ Auto admission# (STU2024xxx)
- ✅ Password hashing
- ✅ Photo upload (Cloudinary)
- ✅ Email duplicate check
- ✅ Admin notification email
- ✅ Full student record (users + students tables)

**Demo**: `/staff/register-student` (admin login required)

✨ **Ready** - Admin registration live alongside public flow!
