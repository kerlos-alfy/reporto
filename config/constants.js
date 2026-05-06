/**
 * @file config/constants.js
 * @description Application-wide constant values.
 *
 * Keep all magic strings and enumerations here so they have a single
 * definition and can be imported wherever needed.
 */

'use strict';

// ─── Labor / Manpower ────────────────────────────────────────────────────────

/** Valid labor source types for report items. */
const LABOR_SOURCE_TYPES = ['In-House', 'Supplier', 'Subcontractor'];

/** Ordered list of trade fields tracked in every manpower object. */
const MANPOWER_FIELDS = [
  { key: 'steelFixer',        label: 'Steel Fixer' },
  { key: 'steelFixerForemen', label: 'Steel Fixer Foremen' },
  { key: 'carpenter',         label: 'Carpenter' },
  { key: 'carpenterForemen',  label: 'Carpenter Foremen' },
  { key: 'helper',            label: 'Helper' },
  { key: 'scaffolding',       label: 'Scaffolding' },
  { key: 'engineersNo',       label: 'Engineers' },
];

// ─── Shifts ───────────────────────────────────────────────────────────────────

/** Valid shift types for both report-level and per-item shift tracking. */
const SHIFT_TYPES = ['Morning', 'Day', 'Night'];

// ─── Reports ──────────────────────────────────────────────────────────────────

/** Prefix used when generating report IDs (e.g. DSR-20260324-0001). */
const REPORT_ID_PREFIX = 'DSR';

/** Maximum number of work items allowed per a single report submission. */
const MAX_ITEMS_PER_REPORT = 50;

/** Number of reports shown per paginated page in the reports list. */
const ITEMS_PER_PAGE = 50;

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * User role identifiers.
 * These must match the enum values in models/AdminUser.js.
 */
const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  VIEWER:     'viewer',
};

// ─── UI Themes ────────────────────────────────────────────────────────────────

/**
 * Valid UI theme slugs.
 * Must match the enum in models/AdminUser.js AND the validation in routes/api.js.
 */
const THEMES = ['navy', 'cyan', 'amber'];

module.exports = {
  LABOR_SOURCE_TYPES,
  MANPOWER_FIELDS,
  SHIFT_TYPES,
  REPORT_ID_PREFIX,
  MAX_ITEMS_PER_REPORT,
  ITEMS_PER_PAGE,
  ROLES,
  THEMES,
};
