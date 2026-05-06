/**
 * @file models/Project.js
 * @description Mongoose model for construction projects (sites).
 *
 * Each project owns an embedded list of `levels` (floors, zones, etc.)
 * and `elements` (columns, beams, slabs, etc.) that are used to populate
 * the report form dropdowns.
 *
 * Both lists support soft-deletion via `isActive` so historical reports
 * that reference a removed level/element remain valid.
 */

'use strict';

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────────────────────────

const projectSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    code:     { type: String, trim: true },    // optional short code, e.g. "PBJA"
    location: { type: String, trim: true },

    isActive: { type: Boolean, default: true },

    // ── Levels (floors / zones) ──────────────────────────────────────────────
    levels: [
      {
        name:      { type: String, required: true, trim: true },
        sortOrder: { type: Number, default: 0 },
        isActive:  { type: Boolean, default: true },
      },
    ],

    // ── Elements (structural components) ────────────────────────────────────
    elements: [
      {
        name:      { type: String, required: true, trim: true },
        sortOrder: { type: Number, default: 0 },
        isActive:  { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

// ─── Instance methods ─────────────────────────────────────────────────────────

/**
 * Return only active levels sorted by `sortOrder`.
 * Used by the report form to populate the level dropdown.
 *
 * @returns {object[]}
 */
projectSchema.methods.getActiveLevels = function () {
  return this.levels
    .filter((l) => l.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Return only active elements sorted by `sortOrder`.
 * Used by the report form to populate the element dropdown.
 *
 * @returns {object[]}
 */
projectSchema.methods.getActiveElements = function () {
  return this.elements
    .filter((e) => e.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

module.exports = mongoose.model('Project', projectSchema);
