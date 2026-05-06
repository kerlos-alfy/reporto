/**
 * @file middlewares/rateLimiter.js
 * @description In-process, in-memory rate limiter middleware.
 *
 * Provides two pre-configured limiter instances:
 *   loginLimiter  — Tight limit for the login endpoint to slow brute-force attacks.
 *   apiLimiter    — Broader limit for general API routes.
 *
 * Limits are configurable via environment variables (see constants below).
 *
 * ⚠️  Production note: This implementation stores hit counts in a plain Map
 * and does NOT share state across multiple Node.js processes or instances.
 * For deployments behind a load balancer or using PM2 cluster mode, replace
 * the RateLimiter class with express-rate-limit + a Redis store.
 */

'use strict';

// ─── Environment-configurable defaults ───────────────────────────────────────

const LOGIN_WINDOW_MS = parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 min
const LOGIN_MAX       = parseInt(process.env.RATE_LIMIT_LOGIN_MAX,       10) || 5;
const API_WINDOW_MS   = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS,   10) || 15 * 60 * 1000;
const API_MAX         = parseInt(process.env.RATE_LIMIT_API_MAX,         10) || 100;

// ─── RateLimiter class ────────────────────────────────────────────────────────

/**
 * Simple in-memory, per-IP rate limiter.
 *
 * Tracks request counts in a Map keyed by client IP address.
 * Stale entries are pruned every minute to prevent unbounded memory growth.
 */
class RateLimiter {
  /**
   * @param {object} [options]
   * @param {number} [options.windowMs=900000]  Sliding window duration in ms (default: 15 min).
   * @param {number} [options.max=100]          Max requests allowed per window.
   * @param {string} [options.message]          Error message returned on rate-limit hit.
   */
  constructor({
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
  } = {}) {
    this.windowMs = windowMs;
    this.max      = max;
    this.message  = message;

    /** @type {Map<string, {count: number, start: number}>} */
    this.hits = new Map();

    // Prune expired entries every minute so the Map doesn't grow unbounded
    this._cleanup = setInterval(() => this._pruneExpired(), 60 * 1000);

    // Allow the Node.js event loop to exit even if this timer is still active
    if (this._cleanup.unref) this._cleanup.unref();
  }

  /**
   * Returns an Express middleware function that enforces the rate limit.
   * Sets standard X-RateLimit-* headers on every response.
   *
   * @returns {import('express').RequestHandler}
   */
  middleware() {
    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();

      let entry = this.hits.get(key);

      // Start a new window if no entry exists or the previous window has expired
      if (!entry || now - entry.start > this.windowMs) {
        entry = { count: 0, start: now };
        this.hits.set(key, entry);
      }

      entry.count++;

      // Set standard rate-limit response headers
      res.setHeader('X-RateLimit-Limit',     this.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - entry.count));
      res.setHeader('X-RateLimit-Reset',     new Date(entry.start + this.windowMs).toISOString());

      if (entry.count > this.max) {
        const retryAfterSecs = Math.ceil((entry.start + this.windowMs - now) / 1000);
        res.setHeader('Retry-After', retryAfterSecs);
        return res.status(429).json({ error: this.message });
      }

      next();
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /** Remove all entries whose window has elapsed. */
  _pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (now - entry.start > this.windowMs) {
        this.hits.delete(key);
      }
    }
  }
}

// ─── Pre-configured instances ─────────────────────────────────────────────────

const loginLimiter = new RateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  max:      LOGIN_MAX,
  message:  'Too many login attempts. Please try again in 15 minutes.',
});

const apiLimiter = new RateLimiter({
  windowMs: API_WINDOW_MS,
  max:      API_MAX,
  message:  'Too many API requests. Please slow down.',
});

module.exports = {
  RateLimiter,
  loginLimiter: loginLimiter.middleware(),
  apiLimiter:   apiLimiter.middleware(),
};
