# 🎯 ADMIN DASHBOARD BUTTON - EASY ADD

**Problem**: No "Register Student" button visible.

**Solution**: Copy-paste snippet to `views/staff/manage-students.ejs` or `views/staff/dashboard-fixed.ejs`.

## Option 1: Manage Students Page (RECOMMENDED)
**File**: `views/staff/manage-students.ejs`

**Add this BEFORE table** (line ~150, after search box):
```html
<div class="mb-4">
    <a href="/staff/register-student" class="btn btn-success btn-lg shadow-sm">
        <i class="fas fa-user-plus me-2"></i>Add New Student
    </a>
</div>
```

**Full context**:
```html
<!-- Add button here -->
<div class="mb-4">
    <a href="/staff/register-student" class="btn btn-success btn-lg shadow-sm">
        <i class="fas fa-user-plus me-2"></i>Add New Student
    </a>
</div>

<!-- Existing search/filter -->
<div class="row align-items-center mb-4">
    <div class="col-md-4">
        <div class="search-box...">
```

## Option 2: Dashboard Card
**File**: `views/staff/dashboard-fixed.ejs`

**Add new card** (in stats row, line ~50):
```html
<div class="col-md-3">
    <div class="glass-card stats-card hover-up">
        <h6 class="text-muted mb-1 text-uppercase small font-weight-bold">Register New</h6>
        <h2 class="fw-bold mb-0 text-success"><i class="fas fa-plus"></i></h2>
        <a href="/staff/register-student" class="btn btn-sm btn-success mt-2 w-100">+ Student</a>
    </div>
</div>
```

## 3. Restart & Test
```bash
node server.js
```

Admin → Manage Students → **"Add New Student" button** → Register form.

**Live**: `/staff/register-student` (works now, just needs button link).

**Done in 30s** - Button appears! 🚀
