// routes/index.js
const express = require('express');
const router = express.Router();

// Home Page
router.get('/', (req, res) => {
    res.render('public/index', {
        title: 'Home - Islamic School',
        page: 'home'
    });
});

// About Page
router.get('/about', (req, res) => {
    res.render('public/about', {
        title: 'About Us - Islamic School',
        page: 'about'
    });
});

// Academics Page
router.get('/academics', (req, res) => {
    res.render('public/academics', {
        title: 'Academics - Islamic School',
        page: 'academics'
    });
});

// Admission Page
router.get('/admission', (req, res) => {
    res.render('public/admission', {
        title: 'Admission - Islamic School',
        page: 'admission'
    });
});

// Contact Page
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us - Islamic School',
        page: 'contact'
    });
});

module.exports = router;
