/**
 * @file routes/admin.js
 * @description Admin panel page routes.
 *
 * Mounted at /admin in app.js. All routes require authentication.
 * Most routes additionally require a specific permission (see requirePermission).
 *
 * Route summary:
 *   GET  /admin/dashboard
 *   GET  /admin/projects
 *   GET  /admin/projects/:id/timeline
 *   GET  /admin/workforce
 *   GET  /admin/manpower-summary
 *   GET  /admin/manpower-breakdown
 *   GET  /admin/reports                 (requires canViewReportsList)
 *   GET  /admin/reports/:reportId       (requires canViewReports)
 *   GET  /admin/master-data             (requires canManageMasters)
 *   POST/PUT/PATCH/DELETE /admin/master-data/*  (require canManageMasters)
 */

'use strict';

const express                    = require('express');
const router                     = express.Router();
const { requireAuth, requirePermission } = require('../middlewares/auth');

const dashboardController       = require('../controllers/dashboardController');
const masterDataController      = require('../controllers/masterDataController');
const timelineController        = require('../controllers/timelineController');
const manpowerSummaryController = require('../controllers/manpowerSummaryController');
const reportController          = require('../controllers/reportController');

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard',
  requireAuth, requirePermission('canViewDashboard'),
  dashboardController.showDashboard
);

// ── Projects ──────────────────────────────────────────────────────────────────

router.get('/projects',
  requireAuth, requirePermission('canViewDashboard'),
  timelineController.showProjects
);

router.get('/projects/:id/timeline',
  requireAuth, requirePermission('canViewDashboard'),
  timelineController.showTimeline
);

// ── Workforce Log ─────────────────────────────────────────────────────────────

router.get('/workforce',
  requireAuth, requirePermission('canViewDashboard'),
  dashboardController.showWorkforce
);

// ── Manpower pages ────────────────────────────────────────────────────────────

router.get('/manpower-summary',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.showManpowerSummary
);

router.get('/manpower-breakdown',
  requireAuth, requirePermission('canViewManpowerSummary'),
  manpowerSummaryController.showManpowerBreakdown
);

// ── Reports ───────────────────────────────────────────────────────────────────

router.get('/reports',
  requireAuth, requirePermission('canViewReportsList'),
  reportController.showReportsList
);

router.get('/reports/:reportId',
  requireAuth, requirePermission('canViewReports'),
  dashboardController.showReportDetail
);

// ── Master data management ────────────────────────────────────────────────────

router.get('/master-data',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.showMasterData
);

// Engineers
router.post('/master-data/engineers',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.addEngineer
);
router.put('/master-data/engineers/:id',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.updateEngineer
);
router.patch('/master-data/engineers/:id/toggle',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.toggleEngineer
);
router.patch('/master-data/engineers/:id/toggle-alerts',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.toggleEngineerAlerts
);

// Projects
router.post('/master-data/projects',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.addProject
);
router.post('/master-data/projects/:id/levels',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.addProjectLevel
);
router.delete('/master-data/projects/:id/levels/:levelId',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.removeProjectLevel
);
router.post('/master-data/projects/:id/elements',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.addProjectElement
);
router.delete('/master-data/projects/:id/elements/:elementId',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.removeProjectElement
);

// Master data items
router.post('/master-data/items',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.addMasterDataItem
);
router.patch('/master-data/items/:id/toggle',
  requireAuth, requirePermission('canManageMasters'),
  masterDataController.toggleMasterDataItem
);

module.exports = router;
