/**
 * @file validators/index.js
 * @description Express-validator rule sets and result handler.
 *
 * Exports:
 *   reportValidationRules  — Middleware array for the report submission form.
 *   loginValidationRules   — Middleware array for the login form.
 *   validate               — Error-collection middleware; must be added after
 *                            the rule set in the route definition.
 *
 * Usage in a route:
 *   router.post('/reports', reportValidationRules, validate, reportController.createReport);
 *
 * On validation failure:
 *   - JSON requests receive a 400 with a structured errors array.
 *   - HTML requests get a flash message and are redirected back.
 *
 * Legacy note — items[].manpower / externalManpower:
 *   These validator rules are retained for backward compatibility with any
 *   clients still submitting the old flat-field format. New submissions
 *   should use items[].sources[].manpower instead.
 */

'use strict';

const { body, validationResult } = require('express-validator');

// ─── Report validation rules ──────────────────────────────────────────────────

const reportValidationRules = [

  // ── Report-level fields ────────────────────────────────────────────────────
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format')
    .toDate(),

  body('engineer')
    .notEmpty().withMessage('Engineer is required')
    .isMongoId().withMessage('Invalid engineer ID'),

  body('site')
    .notEmpty().withMessage('Project/Site is required')
    .isMongoId().withMessage('Invalid project ID'),

  body('generalComment').optional().trim(),
  body('generalDelays').optional().trim(),

  // Report-level shift (optional — per-item shifts are the authoritative source)
  body('shiftType')
    .optional()
    .isIn(['Morning', 'Day', 'Night']).withMessage('Shift must be Morning, Day or Night'),
  body('startTime')
    .optional()
    .matches(/^([01]?\d|2[0-3]):[0-5]\d(\s*(AM|PM))?$/i).withMessage('Invalid start time format'),
  body('endTime')
    .optional()
    .matches(/^([01]?\d|2[0-3]):[0-5]\d(\s*(AM|PM))?$/i).withMessage('Invalid end time format'),

  // ── Items array ────────────────────────────────────────────────────────────
  body('items')
    .isArray({ min: 1, max: 50 }).withMessage('Between 1 and 50 work items required'),

  body('items.*.element')
    .notEmpty().withMessage('Element is required for each item').trim(),
  body('items.*.level')
    .notEmpty().withMessage('Level is required for each item').trim(),
  body('items.*.activity')
    .notEmpty().withMessage('Activity is required for each item').trim(),
  body('items.*.progress')
    .notEmpty().withMessage('Progress is required')
    .isFloat({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100')
    .toFloat(),
  body('items.*.itemComment').optional().trim(),

  // ── Per-item shift ─────────────────────────────────────────────────────────
  body('items.*.shiftType')
    .optional()
    .isIn(['Morning', 'Day', 'Night']).withMessage('Item shift must be Morning, Day or Night'),
  body('items.*.startTime')
    .optional()
    .matches(/^([01]?\d|2[0-3]):[0-5]\d(\s*(AM|PM))?$/i).withMessage('Invalid item start time'),
  body('items.*.endTime')
    .optional()
    .matches(/^([01]?\d|2[0-3]):[0-5]\d(\s*(AM|PM))?$/i).withMessage('Invalid item end time'),

  // ── New schema: sources[] ──────────────────────────────────────────────────
  body('items.*.sources')
    .optional()
    .isArray({ max: 10 }).withMessage('A maximum of 10 labor sources are allowed per item'),
  body('items.*.sources.*.type')
    .notEmpty().withMessage('Source type is required')
    .isIn(['In-House', 'Supplier', 'Subcontractor']).withMessage('Invalid source type'),
  body('items.*.sources.*.companyName')
    .optional().trim().isLength({ max: 200 }).withMessage('Company name must be 200 characters or fewer'),
  body('items.*.sources.*.scopeNotes')
    .optional().trim().isLength({ max: 500 }).withMessage('Scope notes must be 500 characters or fewer'),

  // Sources manpower fields
  body('items.*.sources.*.manpower.steelFixer').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.steelFixerForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.carpenter').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.carpenterForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.helper').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.scaffolding').optional().isInt({ min: 0 }).toInt(),
  body('items.*.sources.*.manpower.engineersNo').optional().isInt({ min: 0 }).toInt(),

  // ── LEGACY flat fields — backward compatibility only ───────────────────────
  // Retained to avoid breaking clients that still submit the old format.
  // New submissions should use items[].sources[].manpower instead.
  body('items.*.laborSourceType')
    .optional()
    .isIn(['In-House', 'Supplier', 'Subcontractor']).withMessage('Invalid labor source type'),
  body('items.*.sourceCompanyName').optional().trim(),
  body('items.*.sourceScopeNotes').optional().trim(),

  body('items.*.manpower.steelFixer').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.steelFixerForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.carpenter').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.carpenterForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.helper').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.scaffolding').optional().isInt({ min: 0 }).toInt(),
  body('items.*.manpower.engineersNo').optional().isInt({ min: 0 }).toInt(),

  body('items.*.externalManpower.steelFixer').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.steelFixerForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.carpenter').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.carpenterForemen').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.helper').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.scaffolding').optional().isInt({ min: 0 }).toInt(),
  body('items.*.externalManpower.engineersNo').optional().isInt({ min: 0 }).toInt(),
  // ── END LEGACY ─────────────────────────────────────────────────────────────
];

// ─── Login validation rules ───────────────────────────────────────────────────

const loginValidationRules = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .trim()
    .toLowerCase()
    .isLength({ max: 50 }).withMessage('Username must be 50 characters or fewer'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password must be 128 characters or fewer'),
];

// ─── Validation result handler ────────────────────────────────────────────────

/**
 * Collect express-validator errors and respond appropriately.
 * Must be placed after the rule-set middleware in the route chain.
 *
 * @type {import('express').RequestHandler}
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const accept      = req.headers.accept      || '';
  const contentType = req.headers['content-type'] || '';
  const isJson      = req.xhr
    || accept.includes('application/json')
    || contentType.includes('application/json');

  if (isJson) {
    return res.status(400).json({
      success: false,
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  req.flash('error', errors.array().map((e) => e.msg).join(', '));
  return res.redirect('back');
}

module.exports = { reportValidationRules, loginValidationRules, validate };
