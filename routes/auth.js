/**
 * @file routes/auth.js
 * @description Authentication routes — login and logout.
 *
 * Mounted at /admin in app.js, so effective paths are:
 *   GET  /admin/login   → Show login form
 *   POST /admin/login   → Process login
 *   POST /admin/logout  → Destroy session and redirect
 */

'use strict';

const express                             = require('express');
const router                              = express.Router();
const { loginLimiter }                    = require('../middlewares/rateLimiter');
const { loginValidationRules, validate }  = require('../validators');
const authController                      = require('../controllers/authController');

// GET  /admin/login
router.get('/login', authController.showLogin);

// POST /admin/login — rate-limited + validated
router.post('/login', loginLimiter, loginValidationRules, validate, authController.login);

// POST /admin/logout
router.post('/logout', authController.logout);

module.exports = router;
