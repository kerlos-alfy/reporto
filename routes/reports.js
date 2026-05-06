/**
 * @file routes/reports.js
 * @description Report submission routes.
 *
 * Mounted at /reports in app.js, so effective paths are:
 *   GET  /reports/new  → Show the daily report form
 *   POST /reports      → Submit a new report
 *
 * Both routes require authentication and the `canSubmitReports` permission
 * (enforced via the requireLinkedEngineer middleware, which also validates
 * that viewer accounts have a linked engineer profile).
 */

'use strict';

const express                        = require('express');
const router                         = express.Router();
const { requireAuth, requireLinkedEngineer } = require('../middlewares/auth');
const { reportValidationRules, validate }    = require('../validators');
const reportController               = require('../controllers/reportController');

// GET  /reports/new — render the submission form
router.get('/new', requireAuth, requireLinkedEngineer, reportController.showNewReport);

// POST /reports — validate and create a new report
router.post('/', requireAuth, requireLinkedEngineer, reportValidationRules, validate, reportController.createReport);

module.exports = router;
