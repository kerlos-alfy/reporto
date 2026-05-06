const dashboardService = require('../services/dashboardService');
const excelService = require('../services/excelService');
const masterDataService = require('../services/masterDataService');
const DailyReport = require('../models/DailyReport');
const { buildDashboardQuery } = require('../utils/queryBuilder');
const { sumMp, emptyMp, addMp } = require('../utils/manpowerHelpers');
const logger = require('../utils/logger');

exports.showDashboard = async (req, res, next) => {
  try {
    const filterOptions = await masterDataService.getFilterOptions();
    res.render('admin/dashboard', { title: 'Admin Dashboard', filterOptions });
  } catch (err) { next(err); }
};

exports.getDashboardData = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      engineer:   req.query.engineer   || null,
      activity:   req.query.activity   || null,
      level:      req.query.level      || null,
      sourceType: req.query.sourceType || null,
      search:     req.query.search     || null,
    };
    const data = await dashboardService.getDashboardData(filters);
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error('Dashboard data error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load dashboard data' });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      engineer:   req.query.engineer   || null,
      activity:   req.query.activity   || null,
      level:      req.query.level      || null,
      sourceType: req.query.sourceType || null,
      search:     req.query.search     || null,
    };
    const data = await dashboardService.getDashboardData(filters);
    const workbook = await excelService.generateReport(data.tableRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `AGILE_Report_${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Excel export error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
};

exports.showReportDetail = async (req, res, next) => {
  try {
    const report = await DailyReport.findOne({ reportId: req.params.reportId }).lean();
    if (!report) {
      req.flash('error', 'Report not found');
      return res.redirect('/admin/dashboard');
    }

    // Check if current user can edit reports
    const AdminUser = require('../models/AdminUser');
    const sessionUser = req.session.adminUser;
    let canEditReports = false;
    if (sessionUser) {
      if (sessionUser.role === 'superadmin') {
        canEditReports = true;
      } else {
        const freshUser = await AdminUser.findById(sessionUser.id).lean();
        if (freshUser) {
          const adminDef = { canEditReports: false };
          if (freshUser.role === 'admin') {
            canEditReports = typeof freshUser.permissions?.canEditReports === 'boolean'
              ? freshUser.permissions.canEditReports
              : (adminDef.canEditReports ?? false);
          } else {
            canEditReports = freshUser.permissions?.canEditReports === true;
          }
        }
      }
    }

    // Get master data for edit form dropdowns
    let formData = {};
    if (canEditReports) {
      formData = await masterDataService.getFormData(sessionUser);
    }

    res.render('admin/report-detail', {
      title: report.reportId,
      report,
      canEditReports,
      engineers: formData.engineers || [],
      projects: formData.projects || [],
      masterElements: formData.masterElements || [],
      masterActivities: formData.masterActivities || [],
    });
  } catch (err) { next(err); }
};

// ─── Workforce Log ─────────────────────────────────────────────────────────────
exports.showWorkforce = async (req, res, next) => {
  try {
    const filterOptions = await masterDataService.getFilterOptions();
    res.render('admin/workforce', { title: 'Workforce Log', filterOptions });
  } catch (err) { next(err); }
};

exports.getWorkforceData = async (req, res) => {
  try {
    const filters = {
      fromDate:   req.query.fromDate   || null,
      toDate:     req.query.toDate     || null,
      project:    req.query.project    || null,
      engineer:   req.query.engineer   || null,
      sourceType: req.query.sourceType || null,
    };
    const query = buildDashboardQuery(filters);
    const reports = await DailyReport.find(query).sort({ date: -1 }).limit(500).lean();

    const rows = reports.map(r => {
      const sourceMap = {};
      let totalManpower = 0;

      (r.items || []).forEach(item => {
        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(s => {
            const key = (s.type || 'In-House') + '||' + (s.companyName || '');
            if (!sourceMap[key]) sourceMap[key] = { type: s.type || 'In-House', companyName: s.companyName || '', totalManpower: 0, manpower: emptyMp() };
            const tot = Number(s.totalManpower) || sumMp(s.manpower);
            sourceMap[key].totalManpower += tot;
            totalManpower += tot;
            addMp(sourceMap[key].manpower, s.manpower);
          });
        } else {
          const srcType = item.laborSourceType || 'In-House';
          const ihKey = 'In-House||';
          if (!sourceMap[ihKey]) sourceMap[ihKey] = { type: 'In-House', companyName: '', totalManpower: 0, manpower: emptyMp() };
          const ihTot = sumMp(item.manpower);
          sourceMap[ihKey].totalManpower += ihTot;
          totalManpower += ihTot;
          addMp(sourceMap[ihKey].manpower, item.manpower);

          if (srcType === 'Supplier' || srcType === 'Subcontractor') {
            const extKey = srcType + '||' + (item.sourceCompanyName || '');
            if (!sourceMap[extKey]) sourceMap[extKey] = { type: srcType, companyName: item.sourceCompanyName || '', totalManpower: 0, manpower: emptyMp() };
            const extTot = sumMp(item.externalManpower) || (Number(item.externalTotalManpower) || 0);
            sourceMap[extKey].totalManpower += extTot;
            totalManpower += extTot;
            addMp(sourceMap[extKey].manpower, item.externalManpower);
          }
        }
      });

      const sources = Object.values(sourceMap).sort((a, b) => {
        const order = { 'In-House': 0, 'Supplier': 1, 'Subcontractor': 2 };
        return (order[a.type] ?? 9) - (order[b.type] ?? 9);
      });

      return {
        reportId: r.reportId, date: r.date, siteName: r.siteName,
        engineerName: r.engineerName, shiftType: r.shiftType || 'Day',
        startTime: r.startTime || '', endTime: r.endTime || '',
        totalManpower, sources,
      };
    });

    return res.json({ success: true, rows });
  } catch (err) {
    logger.error('Workforce data error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load workforce data' });
  }
};

// ─── Alert endpoints ───────────────────────────────────────────────────────────
const alertService = require('../services/alertService');

function _canSeeAlerts(sessionUser) {
  if (!sessionUser) return false;
  if (sessionUser.role === 'superadmin') return true;
  return sessionUser.permissions?.canViewAlerts === true;
}

exports.getActiveAlert = async (req, res) => {
  try {
    if (!_canSeeAlerts(req.session.adminUser)) {
      return res.json({ success: true, alert: null });
    }
    const dismissed = req.session.dismissedAlerts || [];
    const alert = await alertService.getActiveAlert(req.session.adminUser.username, dismissed);
    res.json({ success: true, alert });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to load alert' }); }
};

exports.dismissAlert = async (req, res) => {
  try {
    if (!_canSeeAlerts(req.session.adminUser)) {
      return res.json({ success: true });
    }
    const { date } = req.body;
    if (!req.session.dismissedAlerts) req.session.dismissedAlerts = [];
    if (date && !req.session.dismissedAlerts.includes(date)) {
      req.session.dismissedAlerts.push(date);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: 'Failed to dismiss alert' }); }
};

exports.triggerAlertCheck = async (req, res) => {
  try {
    if (!_canSeeAlerts(req.session.adminUser)) {
      return res.json({ success: true, alert: null });
    }
    req.session.dismissedAlerts = [];
    const alert = await alertService.getActiveAlert(req.session.adminUser.username, []);
    res.json({ success: true, alert });
  } catch (err) { res.status(500).json({ success: false, error: 'Check failed' }); }
};
