/**
 * @file utils/dateHelpers.js
 * @description Date and time formatting utilities used across views and services.
 *
 * All functions accept standard JS Date objects or ISO date strings and
 * return formatted strings suitable for display or form value binding.
 */

'use strict';

/**
 * Format a date as "YYYY-MM-DD".
 * Returns an empty string for falsy input.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Format a date as a human-readable localised datetime string,
 * e.g. "24 Mar 2026, 09:30".
 * Returns an empty string for falsy input.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-GB', {
    year:   'numeric',
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Return today's date as "YYYY-MM-DD" in UTC.
 * Used to set the default value of the date input on the report form.
 *
 * @returns {string}
 */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Convert a 24-hour time string ("HH:MM") to a 12-hour display string
 * ("H:MM AM/PM").
 * Returns an empty string for falsy input.
 *
 * @param {string} time24  Time in "HH:MM" format.
 * @returns {string}
 *
 * @example
 *   formatTime12('13:30') // → '1:30 PM'
 *   formatTime12('08:00') // → '8:00 AM'
 */
function formatTime12(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const hh     = parseInt(hStr, 10);
  const mm     = mStr || '00';
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  return `${hour12}:${mm} ${suffix}`;
}

module.exports = { formatDate, formatDateTime, todayISO, formatTime12 };
