/**
 * @file models/MasterData.js
 * @description Mongoose model for system-wide reference / lookup data.
 *
 * Categories:
 *   element            — Structural elements selectable on the report form.
 *   activity           — Work activities selectable on the report form.
 *   laborSourceType    — Labor source type labels (currently fixed in constants.js).
 *   supplierCompany    — Supplier company name presets for the source dropdown.
 *   subcontractorCompany — Subcontractor company name presets.
 *
 * All entries support soft-deletion via `isActive` and manual ordering
 * via `sortOrder`. The compound unique index on (category, name) prevents
 * duplicate entries within the same category.
 */

'use strict';

const mongoose = require('mongoose');

const masterDataSchema = new mongoose.Schema(
  {
    category: {
      type:     String,
      required: true,
      enum:     ['element', 'activity', 'laborSourceType', 'supplierCompany', 'subcontractorCompany'],
      index:    true,
    },
    name:      { type: String, required: true, trim: true },
    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Prevent duplicate names within the same category
masterDataSchema.index({ category: 1, name: 1 }, { unique: true });

// ─── Statics ──────────────────────────────────────────────────────────────────

/**
 * Fetch all active items for a given category, ordered by sortOrder then name.
 *
 * @param {string} category  One of the valid category values listed above.
 * @returns {Promise<object[]>}  Lean documents.
 */
masterDataSchema.statics.getByCategory = function (category) {
  return this.find({ category, isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
};

module.exports = mongoose.model('MasterData', masterDataSchema);
