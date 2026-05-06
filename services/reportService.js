const DailyReport = require('../models/DailyReport');
const Engineer = require('../models/Engineer');
const Project = require('../models/Project');
const { generateReportId } = require('../utils/reportIdGenerator');
const masterDataService = require('./masterDataService');

class ReportService {
  /**
   * Normalize any time string to HH:MM 24-hour format.
   * Handles: "7:16", "07:16", "7:16 PM", "07:16 AM"
   */
  _normalizeTime(val) {
    if (!val || typeof val !== 'string') return '';
    const m = val.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!m) return '';
    let h = parseInt(m[1], 10);
    const mn = m[2];
    const period = (m[3] || '').toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h < 10 ? '0' : ''}${h}:${mn}`;
  }

  /**
   * Detect shift type from a start time string (HH:MM 24h).
   * 05:00–10:59 → Morning
   * 11:00–13:59 → Day
   * 16:00–23:59 → Night
   * Anything else → Day (fallback)
   */
  _detectShift(startTime) {
    if (!startTime) return 'Day';
    const [hStr] = startTime.split(':');
    const h = parseInt(hStr, 10);
    if (h >= 5  && h <= 10) return 'Morning';
    if (h >= 11 && h <= 13) return 'Day';
    if (h >= 16 && h <= 23) return 'Night';
    return 'Day';
  }

  /**
   * Build a clean manpower object from raw input.
   */
  _buildManpower(mp = {}) {
    return {
      steelFixer:        Number(mp.steelFixer)        || 0,
      steelFixerForemen: Number(mp.steelFixerForemen) || 0,
      carpenter:         Number(mp.carpenter)         || 0,
      carpenterForemen:  Number(mp.carpenterForemen)  || 0,
      helper:            Number(mp.helper)            || 0,
      scaffolding:       Number(mp.scaffolding)       || 0,
      engineersNo:       Number(mp.engineersNo)       || 0,
    };
  }

  /**
   * Get the last recorded progress for a specific combination of
   * Project + Element + Level + Activity.
   */
  async getLastProgress(siteId, element, level, activity) {
    const report = await DailyReport.findOne({
      site: siteId,
      items: {
        $elemMatch: {
          element: element,
          level: level,
          activity: activity,
        },
      },
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    if (!report) return null;

    const item = (report.items || []).find(
      (i) => i.element === element && i.level === level && i.activity === activity
    );

    if (!item) return null;

    return {
      lastProgress: item.progress,
      reportId: report.reportId,
      date: report.date,
      engineerName: report.engineerName,
    };
  }

  /**
   * Get last progress for multiple combinations at once (batch).
   *
   * Instead of loading ALL reports for a project into memory, we fire one
   * targeted findOne() per unique combination in parallel.  Each query uses
   * the existing compound index { site, items.element, items.level,
   * items.activity } via $elemMatch, so it stays fast even on large datasets.
   */
  async getLastProgressBatch(siteId, combinations) {
    if (!combinations || !combinations.length) return {};

    // De-duplicate combinations so we don't fire the same query twice
    const seen = new Set();
    const unique = combinations.filter((c) => {
      const key = `${c.element}|${c.level}|${c.activity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Run all lookups in parallel — reuse the single-combo getLastProgress
    const entries = await Promise.all(
      unique.map(async (c) => {
        const result = await this.getLastProgress(siteId, c.element, c.level, c.activity);
        return [
          `${c.element}|${c.level}|${c.activity}`,
          result,
        ];
      })
    );

    // Build result map, filtering out nulls
    const resultMap = {};
    for (const [key, value] of entries) {
      if (value) resultMap[key] = value;
    }
    return resultMap;
  }

  async createReport(data) {
    const {
      date, engineer: engineerId, site: siteId,
      shiftType, startTime, endTime,
      generalComment, generalDelays, items,
    } = data;

    const [engineer, project] = await Promise.all([
      Engineer.findById(engineerId).lean(),
      Project.findById(siteId).lean(),
    ]);

    if (!engineer) throw new Error('Engineer not found');
    if (!project) throw new Error('Project not found');

    // Validate levels belong to selected project
    const activeLevels = (project.levels || []).filter((l) => l.isActive).map((l) => l.name);
    for (const item of items) {
      if (!activeLevels.includes(item.level)) {
        throw new Error(`Level "${item.level}" does not belong to project "${project.name}"`);
      }
    }

    // Validate sources: Supplier/Subcontractor must have a company name
    for (const item of items) {
      for (const src of (item.sources || [])) {
        if (
          (src.type === 'Supplier' || src.type === 'Subcontractor') &&
          !src.companyName?.trim()
        ) {
          throw new Error(
            `Item "${item.element}": Company name is required for ${src.type}`
          );
        }
      }
    }

    // Validate cumulative progress
    const combinations = items.map((i) => ({
      element: i.element,
      level: i.level,
      activity: i.activity,
    }));

    const lastProgressMap = await this.getLastProgressBatch(siteId, combinations);

    for (const item of items) {
      const key = `${item.element}|${item.level}|${item.activity}`;
      const prev = lastProgressMap[key];
      if (prev && Number(item.progress) < prev.lastProgress) {
        throw new Error(
          `Progress for "${item.element} · ${item.level} · ${item.activity}" cannot decrease. ` +
          `Last recorded: ${prev.lastProgress}% (${prev.reportId}). You entered: ${item.progress}%.`
        );
      }
    }

    const reportId = await generateReportId(date);

    const builtItems = items.map((item, idx) => {
      const normStart = this._normalizeTime(item.startTime);
      return {
        itemNo: idx + 1,
        element: item.element,
        level: item.level,
        activity: item.activity,
        progress: Number(item.progress),
        itemComment: item.itemComment || '',
        sources: (item.sources || []).map((src) => ({
          type: src.type,
          companyName: src.companyName || '',
          scopeNotes: src.scopeNotes || '',
          manpower: this._buildManpower(src.manpower),
        })),
        shiftType: this._detectShift(normStart),
        startTime: normStart,
        endTime:   this._normalizeTime(item.endTime),
      };
    });

    const normReportStart = this._normalizeTime(startTime);
    const report = new DailyReport({
      reportId,
      date: new Date(date),
      engineer: engineerId,
      engineerName: engineer.name,
      site: siteId,
      siteName: project.name,
      shiftType: this._detectShift(normReportStart),
      startTime: normReportStart,
      endTime: this._normalizeTime(endTime),
      generalComment: generalComment || '',
      generalDelays: generalDelays || '',
      items: builtItems,
    });

    await report.save();
    return report;
  }

  async getReportById(id) {
    return DailyReport.findById(id).lean();
  }

  async getReportByReportId(reportId) {
    return DailyReport.findOne({ reportId }).lean();
  }

  /**
   * Update an existing report (admin edit).
   * Accepts partial data — only updates fields that are provided.
   */
  async updateReport(reportId, data) {
    const report = await DailyReport.findOne({ reportId });
    if (!report) throw new Error('Report not found');

    const {
      date, engineer: engineerId, site: siteId,
      shiftType, startTime, endTime,
      generalComment, generalDelays, items,
    } = data;

    // Update header fields if provided
    if (date) report.date = new Date(date);
    if (startTime !== undefined) {
      const ns = this._normalizeTime(startTime);
      report.startTime = ns;
      report.shiftType = this._detectShift(ns);
    }
    if (endTime !== undefined) report.endTime = this._normalizeTime(endTime);
    if (generalComment !== undefined) report.generalComment = generalComment;
    if (generalDelays !== undefined)  report.generalDelays  = generalDelays;

    // Update engineer if changed
    if (engineerId && engineerId !== report.engineer?.toString()) {
      const engineer = await Engineer.findById(engineerId).lean();
      if (!engineer) throw new Error('Engineer not found');
      report.engineer = engineerId;
      report.engineerName = engineer.name;
    }

    // Update site if changed
    if (siteId && siteId !== report.site?.toString()) {
      const project = await Project.findById(siteId).lean();
      if (!project) throw new Error('Project not found');
      report.site = siteId;
      report.siteName = project.name;
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      const project = await Project.findById(report.site).lean();
      if (!project) throw new Error('Project not found');

      // Validate sources
      for (const item of items) {
        for (const src of (item.sources || [])) {
          if ((src.type === 'Supplier' || src.type === 'Subcontractor') && !src.companyName?.trim()) {
            throw new Error(`Item "${item.element}": Company name is required for ${src.type}`);
          }
        }
      }

      report.items = items.map((item, idx) => {
        const ns = this._normalizeTime(item.startTime);
        return {
          itemNo: idx + 1,
          element: item.element,
          level: item.level,
          activity: item.activity,
          progress: Number(item.progress),
          itemComment: item.itemComment || '',
          sources: (item.sources || []).map((src) => ({
            type: src.type,
            companyName: src.companyName || '',
            scopeNotes: src.scopeNotes || '',
            manpower: this._buildManpower(src.manpower),
          })),
          shiftType: this._detectShift(ns),
          startTime: ns,
          endTime:   this._normalizeTime(item.endTime),
        };
      });
    }

    await report.save(); // triggers pre-validate hooks → recalculates totals
    return report;
  }
}

module.exports = new ReportService();
