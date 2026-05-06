/**
 * @file utils/queryBuilder.js
 * @description MongoDB query builder for dashboard and report-list filters.
 *
 * Centralises the logic that converts raw HTTP query parameters into a
 * well-formed Mongoose filter object, including handling for:
 *   - Date ranges
 *   - Project and engineer ObjectId filters
 *   - Item-level activity / level filters
 *   - Labor source type (supports both the legacy flat field and the new
 *     sources[] array schema — see DailyReport.js for the migration note)
 *   - Full-text search ($text for long queries, regex for short ones)
 *
 * The $or / $and combination logic at the bottom handles the edge cases
 * where multiple "OR-group" conditions must be applied simultaneously
 * without one silently overwriting the other.
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Build a MongoDB query object from dashboard filter parameters.
 *
 * @param {object}  filters
 * @param {string}  [filters.fromDate]    ISO date string — lower bound (inclusive).
 * @param {string}  [filters.toDate]      ISO date string — upper bound (inclusive, extended to 23:59:59).
 * @param {string}  [filters.project]     Project ObjectId string.
 * @param {string}  [filters.engineer]    Engineer ObjectId string.
 * @param {string}  [filters.activity]    Exact activity name filter.
 * @param {string}  [filters.level]       Exact level name filter.
 * @param {string}  [filters.sourceType]  Labor source type filter ('In-House', 'Supplier', etc.).
 * @param {string}  [filters.search]      Free-text search string.
 * @returns {object}  A MongoDB query object safe to pass to Model.find().
 */
function buildDashboardQuery(filters) {
  const query = {};

  // ── Date range ──────────────────────────────────────────────────────────────
  if (filters.fromDate || filters.toDate) {
    query.date = {};
    if (filters.fromDate) {
      query.date.$gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      to.setHours(23, 59, 59, 999); // include the full end day
      query.date.$lte = to;
    }
  }

  // ── Project — cast to ObjectId so .lean() equality works ────────────────────
  if (filters.project) {
    try {
      query.site = new mongoose.Types.ObjectId(filters.project);
    } catch (_) {
      query.site = filters.project; // fallback if already an ObjectId instance
    }
  }

  // ── Engineer ─────────────────────────────────────────────────────────────────
  if (filters.engineer) {
    try {
      query.engineer = new mongoose.Types.ObjectId(filters.engineer);
    } catch (_) {
      query.engineer = filters.engineer;
    }
  }

  // ── Item-level exact filters ─────────────────────────────────────────────────
  if (filters.activity) query['items.activity'] = filters.activity;
  if (filters.level)    query['items.level']    = filters.level;

  // ── Labor source type ────────────────────────────────────────────────────────
  // Must match against BOTH the legacy flat field (items.laborSourceType) and
  // the new multi-source array (items.sources[].type) to support old data.
  const sourceTypeConditions = filters.sourceType
    ? [
        { 'items.laborSourceType': filters.sourceType }, // legacy schema
        { 'items.sources.type':    filters.sourceType }, // new schema
      ]
    : null;

  // ── Text search ──────────────────────────────────────────────────────────────
  let searchConditions = null;

  if (filters.search?.trim()) {
    const s = filters.search.trim();

    if (s.length >= 3) {
      // Use the MongoDB text index for longer queries (faster + stemming)
      query.$text = { $search: s };

      // $text is a top-level operator; add sourceType as a separate $or
      if (sourceTypeConditions) {
        query.$or = sourceTypeConditions;
      }
    } else {
      // Regex fallback for very short terms (< 3 chars) that the text index ignores
      const regex = { $regex: s, $options: 'i' };
      searchConditions = [
        { reportId:        regex },
        { engineerName:    regex },
        { siteName:        regex },
        { generalComment:  regex },
        { 'items.element': regex },
        { 'items.activity': regex },
      ];
    }
  }

  // ── Merge $or conditions without overwriting each other ──────────────────────
  // If both sourceType and a short-search regex are active we must wrap each
  // in its own $or inside an $and, otherwise the second $or assignment
  // silently discards the first.
  if (sourceTypeConditions && searchConditions) {
    query.$and = [
      { $or: sourceTypeConditions },
      { $or: searchConditions },
    ];
  } else if (sourceTypeConditions) {
    query.$or = sourceTypeConditions;
  } else if (searchConditions) {
    query.$or = searchConditions;
  }

  return query;
}

module.exports = { buildDashboardQuery };
