/**
 * @file utils/logger.js
 * @description Lightweight application logger.
 *
 * A thin wrapper around the Node.js console methods that adds a level prefix
 * and suppresses debug output in production.
 *
 * Designed to be a drop-in replacement target: swap the implementation here
 * for winston or pino without touching any other file in the codebase.
 *
 * Log levels (ascending severity):
 *   debug  → Development diagnostics only; suppressed in production.
 *   info   → Normal operational events (startup, connections, etc.).
 *   warn   → Recoverable unexpected states worth monitoring.
 *   error  → Failures that need attention.
 */

'use strict';

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  /** @param {...any} args */
  debug: (...args) => { if (!isProd) console.debug('[DEBUG]', ...args); },

  /** @param {...any} args */
  info:  (...args) => console.info('[INFO]',  ...args),

  /** @param {...any} args */
  warn:  (...args) => console.warn('[WARN]',  ...args),

  /** @param {...any} args */
  error: (...args) => console.error('[ERROR]', ...args),
};
