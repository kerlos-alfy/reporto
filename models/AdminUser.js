/**
 * @file models/AdminUser.js
 * @description Mongoose model for application users (admins, viewers, superadmin).
 *
 * Roles (ascending privilege):
 *   viewer      → Only permissions explicitly set to true in the permissions map.
 *   admin       → Inherits ADMIN_DEFAULTS from config/permissions.js; individual
 *                 flags in the permissions map can override.
 *   superadmin  → Passes every permission check unconditionally.
 *
 * The `can(perm)` instance method is a convenience wrapper — it delegates to
 * the shared `userCan` helper in config/permissions.js so all role logic stays
 * in one place.
 */

'use strict';

const mongoose           = require('mongoose');
const bcrypt             = require('bcryptjs');
const { userCan }          = require('../config/permissions');
const { ROLES, THEMES }    = require('../config/constants');

// ─── Schema ───────────────────────────────────────────────────────────────────

const adminUserSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    username:     { type: String, required: true, unique: true, trim: true, lowercase: true },
    email:        { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },

    // ── Role ────────────────────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    Object.values(ROLES),
      default: ROLES.VIEWER,
    },

    // ── Granular permissions ─────────────────────────────────────────────────
    // These override the role defaults defined in config/permissions.js.
    // For superadmin they are ignored entirely.
    permissions: {
      canViewDashboard:       { type: Boolean, default: true  },
      canViewReports:         { type: Boolean, default: true  },
      canViewReportsList:     { type: Boolean, default: false },
      canEditReports:         { type: Boolean, default: false },
      canManageMasters:       { type: Boolean, default: false },
      canManageUsers:         { type: Boolean, default: false },
      canExportData:          { type: Boolean, default: false },
      canViewAlerts:          { type: Boolean, default: false },
      canViewManpowerSummary: { type: Boolean, default: false },
      canSubmitReports:       { type: Boolean, default: false },
    },

    // ── Engineer account linking ─────────────────────────────────────────────
    // When set, the report form auto-fills this engineer and the user is
    // directed to /reports/new immediately after login.
    linkedEngineer: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Engineer',
      default: null,
    },

    // ── Project scope ────────────────────────────────────────────────────────
    // Empty array = access to ALL projects (superadmin / admin behaviour).
    // Non-empty  = user can only view and submit reports for listed projects.
    allowedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],

    isActive:    { type: Boolean, default: true },
    lastLoginAt: { type: Date },

    // ── UI theme preference ──────────────────────────────────────────────────
    theme: {
      type:    String,
      enum:    THEMES,
      default: 'navy',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { timestamps: true }
);

// ─── Instance methods ─────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against the stored bcrypt hash.
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
adminUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Check whether this user has a given permission.
 * Delegates to the shared `userCan` helper so all role logic is centralised.
 *
 * @param {string} perm  Permission key, e.g. 'canManageMasters'.
 * @returns {boolean}
 */
adminUserSchema.methods.can = function (perm) {
  return userCan(this, perm);
};

// ─── Static methods ───────────────────────────────────────────────────────────

/**
 * Hash a plain-text password using bcrypt.
 * Salt rounds are fixed at 12 — a good balance of security and speed.
 *
 * @param {string} plainPassword
 * @returns {Promise<string>}  The bcrypt hash.
 */
adminUserSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, 12);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
