/**
 * @file models/DailyAlert.js
 * @description Mongoose model for daily missing-report alert records.
 *
 * One document is created per day the alert fires (i.e. at least one active
 * engineer did not submit a report for the previous day).
 *
 * The `dismissedBy` array tracks which admin usernames have acknowledged
 * the alert so it is not shown again to them on subsequent dashboard loads.
 *
 * Note: Alert generation and dismissal is handled by services/alertService.js.
 * This model is the persistence layer only.
 */

'use strict';

const mongoose = require('mongoose');

const dailyAlertSchema = new mongoose.Schema(
  {
    date:             { type: Date, required: true }, // the date that was checked (yesterday)
    checkDate:        { type: Date, required: true }, // when the check ran (today, after 08:00 Dubai)
    missingEngineers: [{ type: String }],             // names of engineers who did not submit
    totalEngineers:   { type: Number, default: 0 },
    totalMissing:     { type: Number, default: 0 },
    dismissedBy:      [{ type: String }],             // admin usernames who dismissed the alert
  },
  { timestamps: true }
);

// Only one alert document may exist per checked date
dailyAlertSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('DailyAlert', dailyAlertSchema);
