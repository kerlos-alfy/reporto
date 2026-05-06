/**
 * @file config/session.js
 * @description Express session configuration backed by MongoDB via connect-mongo.
 *
 * Session data is stored in the `sessions` collection in the same MongoDB
 * database used by the application. Sessions expire after 24 hours.
 *
 * Security behaviour:
 *  - In production, SESSION_SECRET must be set in the environment or the
 *    process will exit immediately (fail-fast).
 *  - In development, a random secret is generated per-restart (sessions do
 *    not survive restarts — this is intentional for the dev workflow).
 *  - Cookies are httpOnly always, and secure (HTTPS-only) in production.
 */

'use strict';

const session   = require('express-session');
const MongoStore = require('connect-mongo');
const crypto    = require('crypto');

// ─── Session TTL constants ────────────────────────────────────────────────────

const SESSION_TTL_SECONDS = 24 * 60 * 60;        // 1 day
const COOKIE_MAX_AGE_MS   = SESSION_TTL_SECONDS * 1000;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build and return the configured express-session middleware.
 * Called once during application startup in app.js.
 *
 * @returns {import('express').RequestHandler}
 */
const sessionConfig = () => {
  const secret = _resolveSecret();

  return session({
    secret,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl:       process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl:            SESSION_TTL_SECONDS,
    }),

    cookie: {
      maxAge:   COOKIE_MAX_AGE_MS,
      httpOnly: true,                                           // never accessible via JS
      secure:   process.env.NODE_ENV === 'production',          // HTTPS only in prod
      sameSite: 'lax',
    },
  });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the session secret from the environment.
 * Exits the process in production if the secret is missing or unchanged
 * from the default placeholder.
 *
 * @returns {string} The session secret to use.
 */
function _resolveSecret() {
  const envSecret = process.env.SESSION_SECRET;
  const isPlaceholder = !envSecret || envSecret === 'CHANGE_ME_TO_A_RANDOM_STRING';

  if (isPlaceholder) {
    if (process.env.NODE_ENV === 'production') {
      console.error('✗ FATAL: SESSION_SECRET must be set in production. Exiting.');
      process.exit(1);
    }

    // Development only — random secret per restart; sessions don't survive restarts
    const devSecret = crypto.randomBytes(64).toString('hex');
    console.warn("⚠ No SESSION_SECRET set — using random dev secret (sessions won't persist across restarts)");
    return devSecret;
  }

  return envSecret;
}

module.exports = sessionConfig;
