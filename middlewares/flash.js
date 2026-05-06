/**
 * @file middlewares/flash.js
 * @description Lightweight session-based flash message middleware.
 *
 * Flash messages are written to req.session.flash on one request and
 * consumed (read + deleted) on the next, making them ideal for
 * post-redirect-get patterns.
 *
 * Usage in a controller:
 *   req.flash('error', 'Invalid credentials');
 *   return res.redirect('/admin/login');
 *
 * Usage in an EJS template:
 *   <% if (flash.error) { %> <p class="error"><%= flash.error %></p> <% } %>
 */

'use strict';

/**
 * Attach flash helpers to every request.
 *
 * Reads any pending flash messages from the session into res.locals.flash
 * (available in all EJS templates) then clears them from the session so
 * they are not shown on subsequent requests.
 *
 * Also attaches req.flash(type, message) so controllers can queue new messages.
 *
 * @type {import('express').RequestHandler}
 */
function flash(req, res, next) {
  // Expose pending messages to templates and clear them from the session
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;

  /**
   * Queue a flash message for the next request.
   *
   * @param {string} type     Category key, e.g. 'error', 'success', 'info'.
   * @param {string} message  Human-readable message text.
   */
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };

  next();
}

module.exports = flash;
