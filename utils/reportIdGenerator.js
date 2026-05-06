/**
 * @file utils/reportIdGenerator.js
 * @description Generates human-readable, collision-free daily report IDs.
 *
 * Format: DSR-YYYYMMDD-NNNN
 *   DSR    — Daily Site Report prefix (defined in config/constants.js)
 *   YYYYMMDD — Date the report was submitted
 *   NNNN   — Zero-padded daily sequence number (resets each day)
 *
 * @example
 *   await generateReportId(new Date('2026-03-24')) // → "DSR-20260324-0001"
 *
 * Collision safety: The Counter model uses a MongoDB findByIdAndUpdate with
 * $inc + upsert, which is atomic even under concurrent submissions.
 */

'use strict';

const Counter = require('../models/Counter');

/**
 * Generate the next report ID for a given date.
 *
 * @param {Date|string} date  The report date (used for the date segment and counter key).
 * @returns {Promise<string>}  A formatted report ID, e.g. "DSR-20260324-0042".
 */
async function generateReportId(date) {
  const d      = new Date(date);
  const yyyy   = d.getFullYear();
  const mm     = String(d.getMonth() + 1).padStart(2, '0');
  const dd     = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const seq    = await Counter.getNextSequence(dateStr);
  const seqStr = String(seq).padStart(4, '0');

  return `DSR-${dateStr}-${seqStr}`;
}

module.exports = { generateReportId };
