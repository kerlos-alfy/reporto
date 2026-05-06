/**
 * @file models/DailyReport.js
 * @description Mongoose model for daily construction site reports.
 *
 * Document structure:
 *   DailyReport
 *   ├── report-level fields (date, engineer, site, shift, comments)
 *   └── items[]                         ← One entry per work activity
 *       ├── element / level / activity / progress
 *       ├── per-item shift (startTime, endTime, shiftDurationMinutes)
 *       └── sources[]                   ← Multi-source labor (new schema)
 *           └── type / companyName / scopeNotes / manpower{}
 *
 * Schema evolution note — LEGACY FIELDS:
 *   The flat fields below were used before the multi-source `sources[]` array
 *   was introduced. They are retained for backward compatibility so that
 *   existing reports can still be read and displayed correctly.
 *   Do NOT populate these fields in new reports.
 *     - items[].manpower
 *     - items[].externalManpower / externalTotalManpower
 *     - items[].laborSourceType / sourceCompanyName / sourceScopeNotes
 *
 * Indexes:
 *   - { date: -1, site: 1 }          — most common dashboard query pattern
 *   - { engineerName, date: -1 }      — engineer-specific queries
 *   - Text index across key string fields for full-text search
 */

'use strict';

const mongoose = require('mongoose');

// ─── Time helpers (module-private) ────────────────────────────────────────────

/**
 * Convert a "HH:MM" string to total minutes since midnight.
 * Returns 0 for falsy input.
 *
 * @param {string} t  Time string in "HH:MM" format.
 * @returns {number}
 */
function _toMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Calculate the duration between two "HH:MM" times in minutes.
 * Handles overnight shifts (end < start) by adding 24 hours.
 *
 * @param {string} start  Start time "HH:MM".
 * @param {string} end    End time "HH:MM".
 * @returns {number}  Duration in minutes.
 */
function _calcDuration(start, end) {
  if (!start || !end) return 0;
  let diff = _toMins(end) - _toMins(start);
  if (diff < 0) diff += 24 * 60; // overnight shift
  return diff;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * Trade headcount breakdown within a single labor source entry.
 * All fields default to 0 — only populated fields need to be sent.
 */
const manpowerSchema = new mongoose.Schema(
  {
    steelFixer:        { type: Number, default: 0, min: 0 },
    steelFixerForemen: { type: Number, default: 0, min: 0 },
    carpenter:         { type: Number, default: 0, min: 0 },
    carpenterForemen:  { type: Number, default: 0, min: 0 },
    helper:            { type: Number, default: 0, min: 0 },
    scaffolding:       { type: Number, default: 0, min: 0 },
    engineersNo:       { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * A single labor source entry within a report item.
 * One item can have multiple sources (In-House + one Supplier, for example).
 * `totalManpower` is computed in the pre-validate hook below.
 */
const laborSourceSchema = new mongoose.Schema(
  {
    type: {
      type:     String,
      enum:     ['In-House', 'Supplier', 'Subcontractor'],
      required: true,
    },
    companyName:    { type: String, trim: true, default: '' }, // required for Supplier / Subcontractor
    scopeNotes:     { type: String, trim: true, default: '' },
    manpower:       { type: manpowerSchema, default: () => ({}) },
    totalManpower:  { type: Number, default: 0 },              // computed — do not set manually
  },
  { _id: false }
);

// Compute totalManpower from the manpower sub-document before each save
laborSourceSchema.pre('validate', function () {
  const mp = this.manpower || {};
  this.totalManpower =
    (mp.steelFixer        || 0) +
    (mp.steelFixerForemen || 0) +
    (mp.carpenter         || 0) +
    (mp.carpenterForemen  || 0) +
    (mp.helper            || 0) +
    (mp.scaffolding       || 0) +
    (mp.engineersNo       || 0);
});

/**
 * A single work-activity line item within a daily report.
 */
const dailyReportItemSchema = new mongoose.Schema(
  {
    itemNo:      { type: Number, required: true },
    element:     { type: String, required: true, trim: true },
    level:       { type: String, required: true, trim: true },
    activity:    { type: String, required: true, trim: true },
    progress:    { type: Number, required: true, min: 0, max: 100 },
    itemComment: { type: String, trim: true, default: '' },

    // ── Multi-source labor (current schema) ─────────────────────────────────
    sources:      { type: [laborSourceSchema], default: [] },
    totalManpower: { type: Number, default: 0 }, // computed — do not set manually

    // ── LEGACY flat fields — backward compatibility only ─────────────────────
    // Do NOT populate these in new reports. Kept so old data can be read.
    manpower:              { type: manpowerSchema, default: undefined },
    externalManpower:      { type: manpowerSchema, default: undefined },
    externalTotalManpower: { type: Number, default: 0 },
    laborSourceType:       { type: String, trim: true, default: '' },
    sourceCompanyName:     { type: String, trim: true, default: '' },
    sourceScopeNotes:      { type: String, trim: true, default: '' },
    // ── END LEGACY ───────────────────────────────────────────────────────────

    // ── Per-item shift tracking ──────────────────────────────────────────────
    shiftType:            { type: String, enum: ['Morning', 'Day', 'Night'], default: 'Day' },
    startTime:            { type: String, trim: true, default: '' },
    endTime:              { type: String, trim: true, default: '' },
    shiftDurationMinutes: { type: Number, default: 0 },         // computed — do not set manually
  },
  { _id: false }
);

// Compute totalManpower and shiftDurationMinutes before each save
dailyReportItemSchema.pre('validate', function () {
  // Sum manpower across all labor sources
  this.totalManpower = (this.sources || []).reduce(
    (sum, s) => sum + (s.totalManpower || 0),
    0
  );

  // Compute shift duration from start/end times
  this.shiftDurationMinutes = (this.startTime && this.endTime)
    ? _calcDuration(this.startTime, this.endTime)
    : 0;
});

// ─── Root schema ──────────────────────────────────────────────────────────────

const dailyReportSchema = new mongoose.Schema(
  {
    reportId:     { type: String, required: true, unique: true, index: true },
    date:         { type: Date,   required: true, index: true },
    engineer:     { type: mongoose.Schema.Types.ObjectId, ref: 'Engineer', required: true, index: true },
    engineerName: { type: String, required: true },
    site:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project',  required: true, index: true },
    siteName:     { type: String, required: true },

    // ── Report-level shift ───────────────────────────────────────────────────
    // Kept as a legacy / fallback; per-item shifts are the authoritative source.
    shiftType:            { type: String, enum: ['Morning', 'Day', 'Night'], default: 'Day' },
    startTime:            { type: String, trim: true, default: '' },
    endTime:              { type: String, trim: true, default: '' },
    shiftDurationMinutes: { type: Number, default: 0 }, // computed — do not set manually

    generalComment: { type: String, trim: true, default: '' },
    generalDelays:  { type: String, trim: true, default: '' },

    items: [dailyReportItemSchema],

    // ── Computed summary fields — do not set manually ────────────────────────
    itemsCount:      { type: Number, default: 0 },
    totalManpower:   { type: Number, default: 0 },
    averageProgress: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Recompute summary fields and report-level shift duration before each save
dailyReportSchema.pre('validate', function () {
  this.itemsCount    = this.items.length;
  this.totalManpower = this.items.reduce((sum, item) => sum + (item.totalManpower || 0), 0);

  this.averageProgress = this.items.length > 0
    ? Math.round(
        (this.items.reduce((sum, item) => sum + (item.progress || 0), 0) / this.items.length) * 100
      ) / 100
    : 0;

  this.shiftDurationMinutes = (this.startTime && this.endTime)
    ? _calcDuration(this.startTime, this.endTime)
    : 0;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

dailyReportSchema.index({ date: -1, site: 1 });
dailyReportSchema.index({ engineerName: 1, date: -1 });

// Full-text search across the most user-searchable fields.
// reportId and siteName are weighted higher to surface exact matches first.
dailyReportSchema.index(
  {
    reportId:                      'text',
    engineerName:                  'text',
    siteName:                      'text',
    generalComment:                'text',
    generalDelays:                 'text',
    'items.element':               'text',
    'items.activity':              'text',
    'items.itemComment':           'text',
    'items.sources.companyName':   'text',
  },
  {
    name:    'report_search_text',
    weights: { reportId: 10, siteName: 5, engineerName: 5 },
  }
);

module.exports = mongoose.model('DailyReport', dailyReportSchema);
