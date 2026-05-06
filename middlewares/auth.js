/**
 * @file middlewares/auth.js
 * @description Authentication and authorisation middleware factory.
 *
 * Exports four middleware functions:
 *
 *   requireAuth          — Block unauthenticated requests.
 *   requireSuperAdmin    — Block non-superadmin users.
 *   requirePermission    — Block users without a specific named permission.
 *   requireLinkedEngineer — Block users not linked to an engineer profile.
 *   loadUser             — Attach session user to res.locals (non-blocking).
 *
 * All guards return JSON for API routes (/api/*) and redirects for HTML routes.
 * Permission resolution is delegated to config/permissions.js — no role logic
 * is duplicated here.
 */

'use strict';

const AdminUser            = require('../models/AdminUser');
const { userCan, ROLES }   = require('../config/permissions');

// ─── requireAuth ──────────────────────────────────────────────────────────────

/**
 * Require any authenticated user.
 * Redirects to login for HTML requests; returns 401 JSON for API requests.
 */
function requireAuth(req, res, next) {
  if (req.session?.adminUser) {
    res.locals.adminUser = req.session.adminUser;
    return next();
  }
  return _unauthenticated(req, res);
}

// ─── requireSuperAdmin ────────────────────────────────────────────────────────

/**
 * Require the `superadmin` role.
 * Used for routes that manage system-wide settings or other admin accounts.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.session?.adminUser) return _unauthenticated(req, res);

  if (req.session.adminUser.role !== ROLES.SUPERADMIN) {
    return _forbidden(req, res, 'Access denied — Super Admin only.');
  }

  res.locals.adminUser = req.session.adminUser;
  return next();
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Middleware factory — require a specific permission.
 *
 * Fetches a fresh user record from the database on every call so that
 * permission changes take effect without requiring a re-login.
 *
 * @param {string} perm  Permission key (e.g. 'canManageMasters').
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.get('/master-data', requireAuth, requirePermission('canManageMasters'), handler);
 */
function requirePermission(perm) {
  return async (req, res, next) => {
    if (!req.session?.adminUser) return _unauthenticated(req, res);

    try {
      // Re-fetch from DB to pick up any permission changes made since login
      const user = await AdminUser.findById(req.session.adminUser.id).lean();

      if (!user || !user.isActive) {
        req.session.destroy(() => {});
        return _unauthenticated(req, res);
      }

      if (!userCan(user, perm)) {
        return _forbidden(req, res, 'You do not have permission to access this page.');
      }

      res.locals.adminUser = req.session.adminUser;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// ─── requireLinkedEngineer ────────────────────────────────────────────────────

/**
 * Require both a linked engineer profile AND the `canSubmitReports` permission.
 *
 * Rule matrix:
 *   superadmin  → always passes (no engineer link required)
 *   admin       → needs canSubmitReports permission (no engineer link required)
 *   viewer      → needs linkedEngineer + canSubmitReports permission
 */
function requireLinkedEngineer(req, res, next) {
  if (!req.session?.adminUser) return _unauthenticated(req, res);

  // superadmin bypasses all checks
  if (req.session.adminUser.role === ROLES.SUPERADMIN) {
    res.locals.adminUser = req.session.adminUser;
    return next();
  }

  return AdminUser.findById(req.session.adminUser.id).lean()
    .then((user) => {
      if (!user || !user.isActive) {
        req.session.destroy(() => {});
        return _unauthenticated(req, res);
      }

      // viewer must also have a linked engineer profile
      if (user.role === ROLES.VIEWER && !user.linkedEngineer) {
        const msg = 'Your account is not linked to an engineer profile. Please contact your administrator.';
        return _forbidden(req, res, msg);
      }

      if (!userCan(user, 'canSubmitReports')) {
        return _forbidden(req, res, 'You do not have permission to submit reports.');
      }

      res.locals.adminUser = req.session.adminUser;
      return next();
    })
    .catch((err) => next(err));
}

// ─── loadUser (non-blocking) ──────────────────────────────────────────────────

/**
 * Attach the session user to res.locals so EJS templates can render
 * user-aware UI. Does not block the request — unauthenticated users pass through.
 */
function loadUser(req, res, next) {
  res.locals.adminUser = req.session?.adminUser || null;
  next();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Respond with 401 Unauthorized.
 * JSON for API routes, redirect for HTML routes.
 */
function _unauthenticated(req, res) {
  if (_isApiRequest(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login');
}

/**
 * Respond with 403 Forbidden.
 * JSON for API routes, flash + redirect for HTML routes.
 *
 * @param {object} req
 * @param {object} res
 * @param {string} message  Human-readable reason shown to the user.
 */
function _forbidden(req, res, message) {
  if (_isApiRequest(req)) {
    return res.status(403).json({ error: message });
  }
  req.flash('error', message);
  return res.redirect('/admin/dashboard');
}

/**
 * Detect whether the current request expects a JSON response.
 * Used to switch between redirect and JSON error responses.
 */
function _isApiRequest(req) {
  const accept = req.headers.accept || '';
  return req.xhr
    || req.path.startsWith('/api/')
    || accept.includes('application/json');
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requirePermission,
  requireLinkedEngineer,
  loadUser,
};
