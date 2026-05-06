/**
 * @file services/authService.js
 * @description Authentication service — user lookup and credential verification.
 *
 * Encapsulates the login flow so the authController stays thin and
 * the authentication logic is independently testable.
 *
 * The session payload returned by `authenticate` is a plain serialisable
 * object (no Mongoose document methods) — only the fields required by the
 * middleware layer are included to keep the session size small.
 */

'use strict';

const AdminUser = require('../models/AdminUser');

class AuthService {
  /**
   * Verify credentials and return a session-safe user payload.
   *
   * Steps:
   *   1. Look up the user by username (case-insensitive, active only).
   *   2. Compare the provided password against the stored bcrypt hash.
   *   3. Stamp `lastLoginAt` on success.
   *   4. Return a lean session payload, or null on failure.
   *
   * @param {string} username  Plain-text username (will be lowercased).
   * @param {string} password  Plain-text password.
   * @returns {Promise<object|null>}  Session payload on success; null on failure.
   */
  async authenticate(username, password) {
    const user = await AdminUser.findOne({
      username: username.toLowerCase(),
      isActive: true,
    });

    if (!user) return null;

    const isValid = await user.comparePassword(password);
    if (!isValid) return null;

    // Stamp the last-login time — fire-and-forget (non-blocking)
    user.lastLoginAt = new Date();
    await user.save();

    // Return a minimal, serialisable session payload
    return {
      id:              user._id.toString(),
      name:            user.name,
      username:        user.username,
      role:            user.role,
      permissions:     user.permissions.toObject ? user.permissions.toObject() : user.permissions,
      linkedEngineer:  user.linkedEngineer ? user.linkedEngineer.toString() : null,
      allowedProjects: (user.allowedProjects || []).map((p) => p.toString()),
      theme:           user.theme || 'navy',
    };
  }
}

module.exports = new AuthService();
