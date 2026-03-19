// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const db = require('./config/supabase');
const initDatabase = require('./init-db');
const {
    getEmailStatus
} = require('./services/email');

const app = express();

// Initialize database tables on startup
initDatabase();

// Email service status (Resend/SMTP/Gmail)
try {
    const emailStatus = getEmailStatus();
    console.log(`📧 Email provider: ${emailStatus.provider}${emailStatus.configured ? '' : ' (not configured)'}`);
} catch (e) {}

// Middleware
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Trust proxy for Render deployment (HTTPS)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    proxy: isProduction || process.env.TRUST_PROXY === '1',
    cookie: {
        // Using 'auto' prevents "can't stay logged in" issues when NODE_ENV=production on HTTP,
        // while still setting secure cookies automatically on HTTPS (with trust proxy enabled).
        secure: 'auto',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Flash messages
app.use(flash());

// Global variables for flash messages
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    res.locals.staff = req.session.staff || null;
    res.locals.student = req.session.student || null;
    res.locals.page = ""; // ✅ Global page variable
    res.locals.recaptcha_site_key = process.env.GOOGLE_RECAPTCHA_SITE_KEY || '';
    res.locals.flutterwave_public_key = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
    next();
});

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth-fixed');
const staffRoutes = require('./routes/staff');
const studentRoutes = require('./routes/student');
const contactRoutes = require('./routes/contact');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/staff', staffRoutes);
app.use('/student', studentRoutes);
app.use('/', contactRoutes);

// 404 Error Handler
app.use((req, res) => {
    res.status(404).render('public/404', {
        title: '404 - Page Not Found',
        page: '404'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('public/error', {
        title: 'Error',
        error: err.message,
        page: 'error'
    });
});

// Start Server
const DEFAULT_PORT = 3000;
const hasExplicitPort = typeof process.env.PORT === 'string' && process.env.PORT.trim() !== '';
const parsedPort = hasExplicitPort ? Number.parseInt(process.env.PORT, 10) : NaN;
let PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`🚀 Server running on http://localhost:${port}`);
        console.log(`📚 Islamic School Management System`);
    });

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            if (!hasExplicitPort && port < DEFAULT_PORT + 10) {
                console.warn(`Port ${port} is in use. Retrying on port ${port + 1}...`);
                return startServer(port + 1);
            }

            console.error(`Port ${port} is already in use.`);
            console.error(`Set PORT to a free port and try again (e.g. PORT=3001).`);
            process.exit(1);
        }

        console.error(err);
        process.exit(1);
    });
}

startServer(PORT);
