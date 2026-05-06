/**
 * @file models/Counter.js
 * @description Mongoose model for atomic, per-day sequence counters.
 *
 * Used by reportIdGenerator to produce collision-free daily sequences
 * like DSR-20260324-0001, DSR-20260324-0002, etc.
 *
 * Each document stores a single integer counter keyed by a date string
 * (e.g. "dsr-20260324"). The `getNextSequence` static uses findByIdAndUpdate
 * with `$inc` + `upsert` so it is safe under concurrent submissions.
 */

'use strict';

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // key, e.g. "dsr-20260324"
  seq: { type: Number, default: 0 },
});

// ─── Statics ──────────────────────────────────────────────────────────────────

/**
 * Atomically increment and return the next sequence number for a given date.
 * Creates the counter document on first call for that date (upsert).
 *
 * @param {string} dateStr  Eight-digit date string, e.g. "20260324".
 * @returns {Promise<number>}  The new (post-increment) sequence value.
 */
counterSchema.statics.getNextSequence = async function (dateStr) {
  const key     = `dsr-${dateStr}`;
  const counter = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
