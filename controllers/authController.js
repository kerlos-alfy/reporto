/**
 * @file controllers/authController.js
 * @description Authentication controller — login and logout request handlers.
 *
 * Keeps route handlers thin by delegating credential verification to
 * authService and session management to Express-session.
 */

'use strict';

const logger      = require('../utils/logger');
const authService = require('../services/authService');

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /admin/login
 * Render the login page, or redirect already-authenticated users.
 */
exports.showLogin = (req, res) => {
  if (req.session.adminUser) {
    return res.redirect(_landingPage(req.session.adminUser));
  }
  res.render('auth/login', { title: 'Sign In' });
};

/**
 * POST /admin/login
 * Authenticate the submitted credentials and start a session on success.
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await authService.authenticate(username, password);

    if (!user) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/admin/login');
    }

    req.session.adminUser = user;
    return res.redirect(_landingPage(user));
  } catch (err) {
    logger.error('Login error:', err);
    req.flash('error', 'An error occurred during login. Please try again.');
    return res.redirect('/admin/login');
  }
};

/**
 * POST /admin/logout
 * Destroy the current session and redirect to the login page.
 */
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine the post-login redirect target for a given user.
 * Engineers (users with a linkedEngineer) land on the report form;
 * all other users land on the admin dashboard.
 *
 * @param {object} user  Session user payload.
 * @returns {string}  Redirect path.
 */
function _landingPage(user) {
  return user.linkedEngineer ? '/reports/new' : '/admin/dashboard';
}
