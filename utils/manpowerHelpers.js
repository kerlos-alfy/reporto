/**
 * @file utils/manpowerHelpers.js
 * @description Shared manpower calculation utilities.
 *
 * Single source of truth for manpower arithmetic — imported by
 * dashboardService, excelService, and any other service that needs to
 * aggregate trade headcounts across labor sources.
 */

'use strict';

// ─── Field list ───────────────────────────────────────────────────────────────

/**
 * Ordered list of trade field keys present in every manpower sub-document.
 * Must stay in sync with the manpowerSchema field list in models/DailyReport.js.
 *
 * @type {string[]}
 */
const MP_FIELDS = [
  'steelFixer',
  'steelFixerForemen',
  'carpenter',
  'carpenterForemen',
  'helper',
  'scaffolding',
  'engineersNo',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sum all trade field values in a manpower object.
 * Returns 0 for null/undefined input.
 *
 * @param {object|null} mp  Manpower sub-document.
 * @returns {number}
 */
function sumMp(mp) {
  if (!mp) return 0;
  return MP_FIELDS.reduce((total, field) => total + (Number(mp[field]) || 0), 0);
}

/**
 * Return a manpower object with every trade field initialised to zero.
 * Useful as a starting accumulator for aggregation loops.
 *
 * @returns {Record<string, number>}
 */
function emptyMp() {
  return MP_FIELDS.reduce((obj, field) => { obj[field] = 0; return obj; }, {});
}

/**
 * Add the values from a manpower sub-document into a target object (mutates target).
 * Safely ignores null/undefined `mp` input.
 *
 * @param {Record<string, number>} target  Accumulator object to mutate.
 * @param {object|null}            mp      Source manpower sub-document.
 */
function addMp(target, mp) {
  if (!mp) return;
  MP_FIELDS.forEach((field) => {
    target[field] = (target[field] || 0) + (Number(mp[field]) || 0);
  });
}

/**
 * Convert a duration in minutes to a human-readable string, e.g. "8h 30m".
 * Returns null for null/undefined input.
 *
 * @param {number|null} mins  Duration in minutes.
 * @returns {string|null}
 *
 * @example
 *   fmtDuration(510)  // → '8h 30m'
 *   fmtDuration(60)   // → '1h'
 *   fmtDuration(45)   // → '45m'
 */
function fmtDuration(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h)      return `${h}h`;
  return `${m}m`;
}

module.exports = { MP_FIELDS, sumMp, emptyMp, addMp, fmtDuration };
