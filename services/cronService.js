/**
 * @file services/cronService.js
 * @description Scheduled background job registry.
 *
 * Previously hosted a cron that checked for missing reports on a schedule.
 * That logic was moved to alertService.js and is now triggered on-demand
 * each time the dashboard loads (after 08:00 Dubai time).
 *
 * This file is retained as the canonical place to register future cron jobs.
 * Import and call `startCronJobs()` from server.js when jobs are added.
 *
 * Example for future use:
 *   const cron = require('node-cron');
 *   cron.schedule('0 8 * * *', () => { ... }, { timezone: 'Asia/Dubai' });
 */

'use strict';

/**
 * Register and start all scheduled background jobs.
 * Currently a no-op — extend this function when periodic tasks are needed.
 */
function startCronJobs() {
  // No scheduled jobs are active.
  // Alert checks run on-demand via alertService.getActiveAlert().
}

module.exports = { startCronJobs };
