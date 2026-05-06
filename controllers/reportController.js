/**
 * @file controllers/reportController.js
 * @description Report submission and management controller.
 *
 * Handles:
 *   - Rendering the new report form (GET /reports/new)
 *   - Creating a new report (POST /reports)
 *   - Updating an existing report (PUT /api/admin/reports/:reportId)
 *   - Deleting a report (DELETE /api/admin/reports/:reportId)
 *   - Deleting a single item from a report (DELETE /api/admin/reports/:reportId/items/:itemIndex)
 *   - Fetching a single report for the edit modal (GET /api/admin/reports/:reportId)
 *   - API helpers for the report form dropdowns (levels, elements, last progress)
 *   - Rendering the reports list page (GET /admin/reports)
 */

'use strict';

const DailyReport      = require('../models/DailyReport');
const reportService    = require('../services/reportService');
const masterDataService = require('../services/masterDataService');
const { todayISO }     = require('../utils/dateHelpers');
const logger           = require('../utils/logger');

// ─── Report form ──────────────────────────────────────────────────────────────

/**
 * GET /reports/new
 * Render the daily report submission form pre-populated with master data.
 */
exports.showNewReport = async (req, res, next) => {
  try {
    const sessionUser = req.session?.adminUser || null;
    const formData    = await masterDataService.getFormData(sessionUser);

    res.render('reports/new', {
      title: 'Daily Site Report',
      today: todayISO(),
      ...formData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /reports
 * Create a new daily report from the submitted form data.
 *
 * Security enforcements applied here (before delegating to the service):
 *   1. linkedEngineer override — the session engineer always wins over
 *      any engineer value submitted in the request body.
 *   2. allowedProjects guard — viewers with a project scope list cannot
 *      submit reports for projects outside their scope.
 */
exports.createReport = async (req, res) => {
  try {
    const sessionUser = req.session?.adminUser || null;

    // 1. Enforce linked engineer identity
    if (sessionUser?.linkedEngineer) {
      req.body.engineer = sessionUser.linkedEngineer;
    }

    // 2. Enforce project scope for scoped viewer accounts
    if (
      sessionUser &&
      sessionUser.role !== 'superadmin' &&
      sessionUser.role !== 'admin' &&
      sessionUser.allowedProjects?.length > 0
    ) {
      const submittedSite = req.body.site?.toString();
      if (!sessionUser.allowedProjects.includes(submittedSite)) {
        return res.status(403).json({
          success: false,
          error:   'You do not have access to submit reports for this project.',
        });
      }
    }

    const report = await reportService.createReport(req.body);

    return res.status(201).json({
      success:  true,
      message:  'Report submitted successfully',
      reportId: report.reportId,
    });
  } catch (err) {
    logger.error('Report creation error:', err);
    return res.status(400).json({
      success: false,
      error:   err.message || 'Failed to create report',
    });
  }
};

// ─── Report edit ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports/:reportId
 * Fetch a single report document for the client-side edit modal.
 */
exports.getReport = async (req, res) => {
  try {
    const report = await DailyReport.findOne({ reportId: req.params.reportId }).lean();
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * PUT /api/admin/reports/:reportId
 * Update an existing report (admin edit flow).
 */
exports.updateReport = async (req, res) => {
  try {
    const report = await reportService.updateReport(req.params.reportId, req.body);
    return res.json({
      success:  true,
      message:  'Report updated successfully',
      reportId: report.reportId,
    });
  } catch (err) {
    logger.error('Report update error:', err);
    return res.status(400).json({
      success: false,
      error:   err.message || 'Failed to update report',
    });
  }
};

/**
 * DELETE /api/admin/reports/:reportId
 * Permanently delete an entire report.
 */
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await DailyReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    await DailyReport.deleteOne({ reportId });

    return res.json({ success: true, message: `Report ${reportId} deleted successfully` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * DELETE /api/admin/reports/:reportId/items/:itemIndex
 * Remove a single work item from a report by its array index.
 * Renumbers the remaining items to keep itemNo sequential.
 */
exports.deleteReportItem = async (req, res) => {
  try {
    const { reportId, itemIndex } = req.params;
    const report = await DailyReport.findOne({ reportId });

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const idx = Number(itemIndex);
    if (idx < 0 || idx >= report.items.length) {
      return res.status(400).json({ success: false, error: 'Invalid item index' });
    }

    report.items.splice(idx, 1);
    // Renumber remaining items to keep itemNo sequential
    report.items.forEach((item, i) => { item.itemNo = i + 1; });
    await report.save();

    return res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// ─── Reports list page ────────────────────────────────────────────────────────

/**
 * GET /admin/reports
 * Render the paginated reports list page with filter options.
 */
exports.showReportsList = async (req, res, next) => {
  try {
    const filterOptions = await masterDataService.getFilterOptions();
    res.render('admin/reports-list', {
      title: 'Reports',
      filterOptions,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Report form API helpers ──────────────────────────────────────────────────

/**
 * GET /api/projects/:projectId/levels
 * Return active levels for a project (used to populate the level dropdown).
 */
exports.getProjectLevels = async (req, res) => {
  try {
    const levels = await masterDataService.getProjectLevels(req.params.projectId);
    return res.json({ success: true, levels });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/projects/:projectId/elements
 * Return active elements for a project (used to populate the element dropdown).
 */
exports.getProjectElements = async (req, res) => {
  try {
    const elements = await masterDataService.getProjectElements(req.params.projectId);
    return res.json({ success: true, elements });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/projects/:projectId/last-progress?element=X&level=Y&activity=Z
 * Return the most recent progress value for a given activity/level/element
 * combination — used to pre-fill the progress field on the report form.
 */
exports.getLastProgress = async (req, res) => {
  try {
    const { projectId }          = req.params;
    const { element, level, activity } = req.query;

    // All three filters are required; return null if any is missing
    if (!element || !level || !activity) {
      return res.json({ success: true, lastProgress: null });
    }

    const result = await reportService.getLastProgress(projectId, element, level, activity);

    return res.json({
      success: true,
      ...(result
        ? {
            lastProgress: result.lastProgress,
            reportId:     result.reportId,
            date:         result.date,
            engineerName: result.engineerName,
          }
        : { lastProgress: null }),
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};
