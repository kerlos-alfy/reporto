/**
 * @file services/alertService.js
 * @description On-demand missing-report alert service.
 *
 * Checks whether any active engineers failed to submit a report for
 * the previous day and returns an alert payload if so.
 *
 * The check is performed on every dashboard load (after 08:00 Dubai time)
 * rather than on a cron schedule — this avoids cron state management while
 * still surfacing the alert promptly at the start of each workday.
 *
 * Alert suppression:
 *   The caller passes a list of already-dismissed date strings so the
 *   alert is not shown again after an admin has acknowledged it.
 */

'use strict';

const logger      = require('../utils/logger');
const Engineer    = require('../models/Engineer');
const DailyReport = require('../models/DailyReport');

// ─── AlertService ─────────────────────────────────────────────────────────────

class AlertService {
  /**
   * Evaluate whether a missing-report alert should be shown.
   *
   * Returns null (no alert) when any of the following are true:
   *   - Current Dubai time is before 08:00 (too early to flag)
   *   - No active engineers are enrolled
   *   - All active engineers submitted a report for yesterday
   *   - The admin has already dismissed the alert for yesterday's date
   *
   * @param {string}   adminUsername    Username of the requesting admin (for logging).
   * @param {string[]} dismissedDates   ISO date strings (YYYY-MM-DD) already dismissed by this admin.
   * @returns {Promise<object|null>}    Alert payload or null.
   */
  async getActiveAlert(adminUsername, dismissedDates = []) {
    const dubaiNow  = _dubaiNow();
    const dubaiHour = dubaiNow.getHours();

    // Before 08:00 Dubai time — do not fire the alert yet
    if (dubaiHour < 8) return null;

    const yesterdayKey = _toDubaiDateKey(new Date(dubaiNow.getTime() - 86_400_000));

    // Admin already acknowledged this alert
    if (Array.isArray(dismissedDates) && dismissedDates.includes(yesterdayKey)) {
      return null;
    }

    // Fetch active engineers who are enrolled in the alert
    const engineers = await Engineer.find({
      isActive:          true,
      excludeFromAlerts: { $ne: true },
    }).lean();

    if (!engineers.length) return null;

    // Build the date window for yesterday (midnight → midnight Dubai time)
    const { start: yesterday, end: dayEnd } = _yesterdayWindow(dubaiNow);

    const reports = await DailyReport.find({
      date: { $gte: yesterday, $lt: dayEnd },
    }).lean();

    // Find engineers who have NOT submitted
    const reportedIds = new Set(reports.map((r) => r.engineer?.toString()));
    const missing     = engineers
      .filter((e) => !reportedIds.has(e._id.toString()))
      .map((e) => e.name);

    if (!missing.length) return null;

    logger.info(`[AlertService] ${missing.length}/${engineers.length} engineers missing for ${yesterdayKey}`);

    return {
      date:             yesterdayKey,
      missingEngineers: missing,
      totalEngineers:   engineers.length,
      totalMissing:     missing.length,
    };
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Return the current wall-clock time in the Dubai timezone as a plain JS Date.
 * Note: The Date object itself is still in UTC internally; only its local-
 * string representation reflects Dubai time.
 *
 * @returns {Date}
 */
function _dubaiNow() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })
  );
}

/**
 * Format a Date as "YYYY-MM-DD" using the Dubai locale.
 *
 * @param {Date} date
 * @returns {string}
 */
function _toDubaiDateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
}

/**
 * Build a { start, end } window covering yesterday in Dubai local time.
 *
 * @param {Date} dubaiNow  Current Dubai time.
 * @returns {{ start: Date, end: Date }}
 */
function _yesterdayWindow(dubaiNow) {
  const start = new Date(dubaiNow);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

module.exports = new AlertService();
