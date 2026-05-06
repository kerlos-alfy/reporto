/**
 * @file middlewares/errorHandler.js
 * @description Global Express error handlers — must be the last middleware registered.
 *
 * Two handlers are exported:
 *   notFound     — Catches requests that matched no route (404).
 *   errorHandler — Catches any error passed to next(err) (4xx / 5xx).
 *
 * Both return JSON for API routes and render an EJS error page for HTML routes.
 * Stack traces are hidden in production.
 */

'use strict';

const logger = require('../utils/logger');

// ─── 404 handler ─────────────────────────────────────────────────────────────

/**
 * Catch-all for unmatched routes.
 * Register this after all application routes in app.js.
 *
 * @type {import('express').RequestHandler}
 */
function notFound(req, res, _next) {
  res.status(404);

  if (_expectsJson(req)) {
    return res.json({ error: 'Not found' });
  }
  return res.render('errors/404', { title: '404 — Not Found' });
}

// ─── Global error handler ─────────────────────────────────────────────────────

/**
 * Central error handler — catches any error forwarded via next(err).
 * Must be registered with four arguments so Express recognises it as an
 * error handler rather than a regular middleware.
 *
 * @type {import('express').ErrorRequestHandler}
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const isProd  = process.env.NODE_ENV === 'production';

  // Log every server error with a timestamp for easier correlation
  logger.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} — ${err.message}`);
  if (!isProd) logger.error(err.stack);

  if (_expectsJson(req)) {
    return res.status(status).json({
      error: isProd ? 'Internal server error' : err.message,
      ...(isProd ? {} : { stack: err.stack }),
    });
  }

  res.status(status).render('errors/500', {
    title:   'Server Error',
    message: isProd ? 'Something went wrong' : err.message,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return true if the request expects a JSON response.
 * Checked against XHR flag, path prefix, Accept header, and Content-Type.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function _expectsJson(req) {
  if (req.xhr) return true;
  if (req.path.startsWith('/api/')) return true;
  const accept      = req.headers.accept      || '';
  const contentType = req.headers['content-type'] || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

module.exports = { notFound, errorHandler };
