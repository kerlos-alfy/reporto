/**
 * @file models/Engineer.js
 * @description Mongoose model for on-site engineers who submit daily reports.
 *
 * Engineer records are linked to AdminUser accounts via the `linkedEngineer`
 * field on AdminUser — this enables the report form to auto-fill the engineer
 * identity and restricts submission to the correct account.
 *
 * The `excludeFromAlerts` flag allows temporary removal from the daily
 * missing-report alert without fully deactivating the engineer (e.g. during
 * annual leave or public holidays).
 */

'use strict';

const mongoose = require('mongoose');

const engineerSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },

    /** Set to false to prevent the engineer from appearing in any dropdowns. */
    isActive: { type: Boolean, default: true },

    /**
     * When true, this engineer is excluded from the daily missing-report
     * alert even if no report was submitted for yesterday.
     * Useful for planned absences (leave, public holidays, off-rotation).
     */
    excludeFromAlerts: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Engineer', engineerSchema);
