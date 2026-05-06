/**
 * @file routes/api.js
 * @description JSON API routes for dynamic dashboard interactions.
 *
 * Mounted at /api in app.js. All routes are rate-limited via apiLimiter.
 * Authentication is required for every route; some additionally require
 * specific permissions.
 *
 * Route summary:
 *
 *   Theme
 *     POST   /api/theme                               — Save UI theme preference
 *
 *   Report form helpers
 *     GET    /api/projects/:projectId/levels          — Levels dropdown data
 *     GET    /api/projects/:projectId/elements        — Elements dropdown data
 *     GET    /api/projects/:projectId/last-progress   — Last recorded progress for an activity
 *
 *   Filter options
 *     GET    /api/admin/filter-options                — Activity/level/element options for filters
 *
 *   Dashboard data
 *     GET    /api/admin/dashboard                     — Dashboard chart data
 *     GET    /api/admin/workforce                     — Workforce log data
 *     GET    /api/admin/manpower-summary              — Manpower summary table data
 *     GET    /api/admin/manpower-breakdown            — Manpower breakdown table data
 *
 *   Exports
 *     GET    /api/admin/export/excel                  — Export dashboard data as Excel
 *     GET    /api/admin/manpower-breakdown/export/excel — Export breakdown as Excel
 *     GET    /api/admin/manpower-breakdown/export/pdf   — Export breakdown as PDF
 *
 *   Alerts
 *     GET    /api/admin/alert                         — Fetch active alert
 *     POST   /api/admin/alert/dismiss                 — Dismiss the active alert
 *     POST   /api/admin/alert/check                   — Trigger an on-demand alert check
 *
 *   Report CRUD
 *     GET    /api/admin/reports/:reportId             — Fetch single report (for edit modal)
 *     PUT    /api/admin/reports/:reportId             — Update report
 *     DELETE /api/admin/reports/:reportId             — Delete report
 *     DELETE /api/admin/reports/:reportId/items/:idx  — Remove a single item
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const { requireAuth, requireLinkedEngineer, requirePermission } = require('../middlewares/auth');
const { apiLimiter }     = require('../middlewares/rateLimiter');
const { THEMES }         = require('../config/constants');
const AdminUser          = require('../models/AdminUser');
const reportController   = require('../controllers/reportController');
const dashboardController = require('../controllers/dashboardController');
const manpowerSummaryController = require('../controllers/manpowerSummaryController');

// Apply rate limiter to every API route
router.use(apiLimiter);

// ── Theme preference ──────────────────────────────────────────────────────────

/**
 * POST /api/theme
 * Persist the user's chosen UI theme to their account record.
 * The new theme is also written back into the session so templates update
 * immediately without requiring a re-login.
 */
router.post('/theme', requireAuth, async (req, res) => {
  const { theme } = req.body;

  if (!THEMES.includes(theme)) {
    return res.status(400).json({ error: `Invalid theme. Valid values: ${THEMES.join(', ')}` });
  }

  try {
    await AdminUser.findByIdAndUpdate(req.session.adminUser.id, { theme });
    req.session.adminUser = { ...req.session.adminUser, theme };
    return res.json({ ok: true, theme });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save theme preference' });
  }
});

// ── Report form helpers ───────────────────────────────────────────────────────

router.get('/projects/:projectId/levels',
  requireAuth, requireLinkedEngineer,
  reportController.getProjectLevels
);

router.get('/projects/:projectId/elements',
  requireAuth, requireLinkedEngineer,
  reportController.getProjectElements
);

router.get('/projects/:projectId/last-progress',
  requireAuth, requireLinkedEngineer,
  reportController.getLastProgress
);

// ── Filter options ────────────────────────────────────────────────────────────

router.get('/admin/filter-options',
  requireAuth,
  manpowerSummaryController.getFilterOptions
);

// ── Dashboard data ────────────────────────────────────────────────────────────

router.get('/admin/dashboard',
  requireAuth,
  dashboardController.getDashboardData
);

router.get('/admin/workforce',
  requireAuth,
  dashboardController.getWorkforceData
);

router.get('/admin/manpower-summary',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.getManpowerSummaryData
);

router.get('/admin/manpower-breakdown',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.getManpowerBreakdownData
);

// ── Exports ───────────────────────────────────────────────────────────────────

router.get('/admin/export/excel',
  requireAuth,
  dashboardController.exportExcel
);

router.get('/admin/manpower-breakdown/export/excel',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.exportBreakdownExcel
);

router.get('/admin/manpower-breakdown/export/pdf',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.exportBreakdownPDF
);

// ── Alert APIs ────────────────────────────────────────────────────────────────

router.get('/admin/alert',
  requireAuth,
  dashboardController.getActiveAlert
);

router.post('/admin/alert/dismiss',
  requireAuth,
  dashboardController.dismissAlert
);

router.post('/admin/alert/check',
  requireAuth,
  dashboardController.triggerAlertCheck
);

// ── Report CRUD ───────────────────────────────────────────────────────────────

// Fetch single report (for the client-side edit modal)
router.get('/admin/reports/:reportId',
  requireAuth, requirePermission('canEditReports'),
  reportController.getReport
);

// Update
router.put('/admin/reports/:reportId',
  requireAuth, requirePermission('canEditReports'),
  reportController.updateReport
);

// Delete entire report
router.delete('/admin/reports/:reportId',
  requireAuth, requirePermission('canEditReports'),
  reportController.deleteReport
);

// Delete a single item from a report
router.delete('/admin/reports/:reportId/items/:itemIndex',
  requireAuth, requirePermission('canEditReports'),
  reportController.deleteReportItem
);

module.exports = router;
