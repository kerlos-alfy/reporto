/**
 * @file server.js
 * @description Application entry point.
 *
 * Responsibilities:
 *   1. Load environment variables from .env
 *   2. Connect to MongoDB
 *   3. Start background jobs (currently a no-op — see services/cronService.js)
 *   4. Start the HTTP server
 *
 * Kept deliberately minimal — all Express configuration lives in app.js.
 * This separation allows app.js to be imported in tests without starting
 * the server or touching the database.
 */

'use strict';

require('dotenv').config();

const app       = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 3100;

// ── Global error safety nets ──────────────────────────────────────────────────
// These catch errors that escape all other handlers and would otherwise
// crash the process silently.

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Do not exit — allow the request to time out gracefully
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1); // Unrecoverable — exit and let the process manager restart
});

// ── Startup sequence ──────────────────────────────────────────────────────────

async function start() {
  // 1. Connect to MongoDB first — the app cannot function without it
  await connectDB();

  // 2. Start any scheduled background jobs
  const { startCronJobs } = require('./services/cronService');
  startCronJobs();

  // 3. Start the HTTP server
  const server = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`\n🚀  Reporto`);
    console.log(`    Environment : ${env}`);
    console.log(`    URL         : http://localhost:${PORT}`);
    console.log(`    Report Form : http://localhost:${PORT}/reports/new`);
    console.log(`    Dashboard   : http://localhost:${PORT}/admin/dashboard\n`);
  });

  // Extend timeout for long-running Excel/PDF export requests (2 minutes)
  server.timeout = 120_000;
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
