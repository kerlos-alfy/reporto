const manpowerSummaryService = require('../services/manpowerSummaryService');
const masterDataService      = require('../services/masterDataService');
const logger                 = require('../utils/logger');
const exportService          = require('../services/manpowerBreakdownExportService');

/**
 * GET /admin/manpower-summary
 */
exports.showManpowerSummary = async (req, res, next) => {
  try {
    const filterOptions = await masterDataService.getFilterOptions();
    res.render('admin/manpower-summary', { title: 'Manpower Summary', filterOptions });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/manpower-summary
 */
exports.getManpowerSummaryData = async (req, res) => {
  try {
    const filters = {
      fromDate: req.query.fromDate || null,
      toDate:   req.query.toDate   || null,
      project:  req.query.project  || null,
      activity: req.query.activity || null,
      level:    req.query.level    || null,
      element:  req.query.element  || null,
    };
    const data = await manpowerSummaryService.getSummary(filters);
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error('Manpower summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load manpower summary' });
  }
};

/**
 * GET /admin/manpower-breakdown
 */
exports.showManpowerBreakdown = async (req, res, next) => {
  try {
    const filterOptions = await masterDataService.getFilterOptions();
    res.render('admin/manpower-breakdown', { title: 'Manpower Breakdown', filterOptions });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/manpower-breakdown
 */
exports.getManpowerBreakdownData = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      sourceType: req.query.sourceType || 'all',
      activity:   req.query.activity   || null,
      level:      req.query.level      || null,
      element:    req.query.element    || null,
    };
    const data = await manpowerSummaryService.getBreakdown(filters);
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error('Manpower breakdown error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load manpower breakdown' });
  }
};

/**
 * GET /api/admin/filter-options?project=PROJECT_ID
 * Returns dynamic activity / level / element options filtered by project.
 */
exports.getFilterOptions = async (req, res) => {
  try {
    const mongoose    = require('mongoose');
    const DailyReport = require('../models/DailyReport');

    const query = {};
    if (req.query.project) {
      try   { query.site = new mongoose.Types.ObjectId(req.query.project); }
      catch (_) { query.site = req.query.project; }
    }

    const reports = await DailyReport.find(query)
      .select('items.activity items.level items.element')
      .lean();

    const items = reports.flatMap(r => r.items || []);

    return res.json({
      success:    true,
      activities: [...new Set(items.map(i => i.activity).filter(Boolean))].sort(),
      levels:     [...new Set(items.map(i => i.level).filter(Boolean))].sort(),
      elements:   [...new Set(items.map(i => i.element).filter(Boolean))].sort(),
    });
  } catch (err) {
    logger.error('getFilterOptions error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load filter options' });
  }
};

/**
 * GET /api/admin/manpower-breakdown/export/excel
 */
exports.exportBreakdownExcel = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      sourceType: req.query.sourceType || 'all',
      activity:   req.query.activity   || null,
      level:      req.query.level      || null,
      element:    req.query.element    || null,
    };
    const data     = await manpowerSummaryService.getBreakdown(filters);
    const wb       = await exportService.generateExcel(data, filters);
    const dateTag  = new Date().toISOString().slice(0, 10);
    const filename = `Manpower-Breakdown-${dateTag}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Excel export error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate Excel: ' + err.message });
  }
};

/**
 * GET /api/admin/manpower-breakdown/export/pdf
 */
exports.exportBreakdownPDF = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      sourceType: req.query.sourceType || 'all',
      activity:   req.query.activity   || null,
      level:      req.query.level      || null,
      element:    req.query.element    || null,
    };
    const data     = await manpowerSummaryService.getBreakdown(filters);
    const buffer   = await exportService.generatePDF(data, filters);
    const dateTag  = new Date().toISOString().slice(0, 10);
    const filename = `Manpower-Breakdown-${dateTag}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    logger.error('PDF export error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate PDF: ' + err.message });
  }
};
