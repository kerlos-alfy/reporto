/**
 * @file config/permissions.js
 * @description Centralised permission definitions for the role-based access system.
 *
 * All role default logic lives here — middlewares, models, and controllers
 * import from this file instead of maintaining their own copies.
 *
 * Roles (in ascending privilege order):
 *   viewer      → only what's explicitly granted via user.permissions
 *   admin       → inherits ADMIN_DEFAULTS; individual flags may override
 *   superadmin  → always passes every permission check
 */

'use strict';

// ─── Canonical permission keys ────────────────────────────────────────────────

/**
 * All permission keys recognised by the system.
 * Any key not in this list will be silently ignored by the middleware.
 * @type {string[]}
 */
const ALL_PERMISSIONS = [
  'canViewDashboard',
  'canViewReports',
  'canViewReportsList',
  'canEditReports',
  'canManageMasters',
  'canManageUsers',
  'canExportData',
  'canViewAlerts',
  'canViewManpowerSummary',
  'canSubmitReports',
];

// ─── Role defaults ────────────────────────────────────────────────────────────

/**
 * Default permission values for the `admin` role.
 * A permission not listed here defaults to `false`.
 *
 * Individual admin accounts may override any of these via user.permissions.
 * superadmin accounts skip this map entirely.
 *
 * @type {Record<string, boolean>}
 */
const ADMIN_DEFAULTS = {
  canViewDashboard:       true,
  canViewReports:         true,
  canViewReportsList:     false,   // opt-in — can be noisy for field admins
  canEditReports:         false,   // destructive — explicit grant required
  canManageMasters:       true,
  canManageUsers:         false,   // HR-sensitive — explicit grant required
  canExportData:          true,
  canViewAlerts:          false,
  canViewManpowerSummary: true,
  canSubmitReports:       false,   // admins rarely submit; grant per account
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Resolve whether a plain user object (from DB .lean() or session) has a
 * given permission, taking role hierarchy into account.
 *
 * @param {object}  user  Plain user object with `role` and `permissions` fields.
 * @param {string}  perm  Permission key to check (e.g. 'canManageMasters').
 * @returns {boolean}
 */
function userCan(user, perm) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;

  if (user.role === 'admin') {
    // Explicit override wins; fall back to role default
    const override = user.permissions?.[perm];
    return typeof override === 'boolean' ? override : (ADMIN_DEFAULTS[perm] ?? false);
  }

  // viewer — only what's explicitly granted
  return user.permissions?.[perm] === true;
}

module.exports = { ALL_PERMISSIONS, ADMIN_DEFAULTS, userCan };
