const DailyReport = require('../models/DailyReport');
const { buildDashboardQuery } = require('../utils/queryBuilder');
const masterDataService = require('./masterDataService');
const { sumMp, emptyMp, addMp } = require('../utils/manpowerHelpers');

class DashboardService {
  async getDashboardData(filters) {
    const query = buildDashboardQuery(filters);

    const reports = await DailyReport.find(query)
      .sort({ date: -1 })
      .limit(500)
      .lean();

    const totalCount = await DailyReport.countDocuments(query);

    // ── Filter items inside each report to match level/activity/sourceType ──
    // MongoDB query matches the *report* if any item matches, but returns the
    // full report with all items. We need to trim items so that summary/charts
    // only count the matching items, not the whole report.
    const filteredReports = this._filterReportItems(reports, filters);

    const summary          = this._computeSummary(filteredReports);
    const insights         = this._computeInsights(filteredReports);
    const charts           = this._computeCharts(filteredReports);
    const groupedReports   = this._buildGroupedReports(filteredReports);
    const tableRows        = this._buildTableRows(filteredReports);
    const filterOptions    = await masterDataService.getFilterOptions();
    const manpowerBreakdown = this._computeManpowerBreakdown(filteredReports);
    const operationsPanel  = this._computeOperationsPanel(filteredReports);

    return {
      summary,
      insights,
      charts,
      manpowerBreakdown,
      operationsPanel,
      groupedReports,
      tableRows,
      filterOptions,
      totalCount,
      limitApplied: totalCount > 500,
    };
  }

  // ─── Helper: get total from a source entry ────────────────────────────────
  // Prefers pre-calculated s.totalManpower, falls back to summing trades.
  // This is the correct approach for the new schema where manpower{} sub-fields
  // may be zero but totalManpower is already stored on the source document.
  _sourceTot(s) {
    if (!s) return 0;
    const pre = Number(s.totalManpower);
    if (pre > 0) return pre;
    return this._sumMp(s.manpower);
  }

  // ─── Delegate to shared helpers ───────────────────────────────────────────
  _sumMp(mp)           { return sumMp(mp); }
  _addTrades(target, mp) { return addMp(target, mp); }

  // ─── Resolve sources array (new schema) or build synthetic one (legacy) ───
  _resolveSources(i) {
    if (i.sources && i.sources.length > 0) return i.sources;
    // Legacy: build synthetic source entries so the rest of the code is uniform
    const result = [];
    const inHouseTot = this._sumMp(i.manpower);
    if (inHouseTot > 0 || (i.laborSourceType === 'In-House') || !i.laborSourceType) {
      result.push({
        type: 'In-House',
        companyName: '',
        manpower: i.manpower || {},
        totalManpower: inHouseTot,
      });
    }
    const extType = i.laborSourceType;
    if (extType === 'Supplier' || extType === 'Subcontractor') {
      const extTot = this._sumMp(i.externalManpower) || (Number(i.externalTotalManpower) || 0);
      if (extTot > 0 || i.sourceCompanyName) {
        result.push({
          type: extType,
          companyName: i.sourceCompanyName || '',
          manpower: i.externalManpower || {},
          totalManpower: extTot,
        });
      }
    }
    return result;
  }

  // ─── Filter items inside reports to match level / activity / sourceType ──
  // Returns a new array of reports where each report's items[] is trimmed to
  // only the items that satisfy the item-level filters. Reports that end up
  // with zero items after filtering are removed entirely.
  _filterReportItems(reports, filters = {}) {
    const { level, activity, sourceType } = filters;
    const hasItemFilter = level || activity || sourceType;
    if (!hasItemFilter) return reports; // nothing to trim — return as-is

    const filtered = [];
    for (const r of reports) {
      const items = (r.items || []).filter(item => {
        if (level    && item.level    !== level)    return false;
        if (activity && item.activity !== activity) return false;
        if (sourceType) {
          const sources = this._resolveSources(item);
          const match = sources.some(s => s.type === sourceType) ||
                        item.laborSourceType === sourceType;
          if (!match) return false;
        }
        return true;
      });

      if (items.length === 0) continue;

      // Re-compute report-level aggregates for the trimmed items
      const totalManpower = items.reduce((sum, item) => {
        const sources = this._resolveSources(item);
        return sum + sources.reduce((s, src) => s + this._sourceTot(src), 0);
      }, 0);

      filtered.push({
        ...r,
        items,
        itemsCount:      items.length,
        totalManpower,
        averageProgress: items.length > 0
          ? Math.round(items.reduce((s, i) => s + (Number(i.progress) || 0), 0) / items.length * 100) / 100
          : 0,
      });
    }
    return filtered;
  }

  _computeSummary(reports) {
    const totalReports    = reports.length;
    const totalActivities = reports.reduce((s, r) => s + (Number(r.itemsCount) || 0), 0);

    // Compute totalManpower from sources[] (new schema), fallback to stored r.totalManpower
    const totalManpower   = reports.reduce((s, r) => {
      let rTotal = 0;
      (r.items || []).forEach(item => {
        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(src => { rTotal += this._sourceTot(src); });
        } else {
          rTotal += (Number(item.totalManpower) || 0) + (Number(item.externalTotalManpower) || 0);
        }
      });
      return s + (rTotal || (Number(r.totalManpower) || 0));
    }, 0);

    const activeProjects  = new Set(reports.map((r) => r.siteName)).size;

    const averageProgress =
      totalActivities > 0
        ? Math.round(
            (reports.reduce(
              (s, r) => s + (r.items || []).reduce((a, i) => a + (Number(i.progress) || 0), 0),
              0
            ) / totalActivities) * 100
          ) / 100
        : 0;

    return { totalReports, totalActivities, totalManpower, activeProjects, averageProgress };
  }

  _computeInsights(reports) {
    if (reports.length === 0) {
      return {
        mostStaffedProject: 'N/A',
        topEngineer: 'N/A',
        highestManpowerActivity: 'N/A',
        lowestProgressActivity: 'N/A',
        externalLaborActivities: 0,
        averageManpowerPerReport: 0,
      };
    }

    const projectManpowerCounts = {};
    reports.forEach((r) => {
      projectManpowerCounts[r.siteName] =
        (projectManpowerCounts[r.siteName] || 0) + (Number(r.totalManpower) || 0);
    });
    const mostStaffedProject =
      Object.entries(projectManpowerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const engCounts = {};
    reports.forEach((r) => {
      engCounts[r.engineerName] =
        (engCounts[r.engineerName] || 0) + (Number(r.itemsCount) || 0);
    });
    const topEngineer =
      Object.entries(engCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const activityManpower = {};
    reports.forEach((r) => {
      (r.items || []).forEach((i) => {
        activityManpower[i.activity] =
          (activityManpower[i.activity] || 0) + (Number(i.totalManpower) || 0);
      });
    });
    const highestManpowerActivity =
      Object.entries(activityManpower).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const activityProgress      = {};
    const activityProgressCount = {};
    reports.forEach((r) => {
      (r.items || []).forEach((i) => {
        activityProgress[i.activity]      = (activityProgress[i.activity] || 0) + (Number(i.progress) || 0);
        activityProgressCount[i.activity] = (activityProgressCount[i.activity] || 0) + 1;
      });
    });
    let lowestProgressActivity = 'N/A';
    let lowestAvg = Infinity;
    Object.keys(activityProgress).forEach((act) => {
      const avg = activityProgress[act] / activityProgressCount[act];
      if (avg < lowestAvg) { lowestAvg = avg; lowestProgressActivity = act; }
    });

    // FIX: count external labor from new schema (sources[]) + legacy fallback
    let externalLaborActivities = 0;
    reports.forEach((r) => {
      (r.items || []).forEach((i) => {
        const sources = this._resolveSources(i);
        const hasExternal = sources.some(
          s => s.type === 'Supplier' || s.type === 'Subcontractor'
        );
        if (hasExternal) externalLaborActivities++;
      });
    });

    const averageManpowerPerReport =
      Math.round(
        (reports.reduce((sum, r) => sum + (Number(r.totalManpower) || 0), 0) / reports.length) * 10
      ) / 10;

    return {
      mostStaffedProject,
      topEngineer,
      highestManpowerActivity,
      averageManpowerPerReport,
      lowestProgressActivity,
      externalLaborActivities,
    };
  }

  _computeCharts(reports) {
    const projectProgressMap   = {};
    const projectProgressCount = {};
    const projectManpowerMap   = {};
    const engineerActivityMap  = {};
    const sourceDistMap        = {};

    reports.forEach((r) => {
      (r.items || []).forEach((i) => {
        // Project progress
        projectProgressMap[r.siteName]   = (projectProgressMap[r.siteName] || 0) + (Number(i.progress) || 0);
        projectProgressCount[r.siteName] = (projectProgressCount[r.siteName] || 0) + 1;

        // Project manpower — use sources[] sum if available, fallback to i.totalManpower
        const itemMp = (() => {
          const sources = this._resolveSources(i);
          if (sources.length > 0) return sources.reduce((s, src) => s + this._sourceTot(src), 0);
          return Number(i.totalManpower) || 0;
        })();
        projectManpowerMap[r.siteName] = (projectManpowerMap[r.siteName] || 0) + itemMp;

        // Engineer activities
        engineerActivityMap[r.engineerName] = (engineerActivityMap[r.engineerName] || 0) + 1;

        // FIX: source distribution — read from sources[] (new schema) or legacy field
        const sources = this._resolveSources(i);
        sources.forEach(s => {
          const t = s.type || 'In-House';
          sourceDistMap[t] = (sourceDistMap[t] || 0) + this._sourceTot(s);
        });
      });
    });

    const projectProgressEntries = Object.keys(projectProgressMap)
      .map((k) => ({
        label: k,
        value: Math.round((projectProgressMap[k] / projectProgressCount[k]) * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value);

    const projectManpowerEntries = Object.keys(projectManpowerMap)
      .map((k) => ({ label: k, value: projectManpowerMap[k] }))
      .sort((a, b) => b.value - a.value);

    return {
      projectProgress: {
        labels: projectProgressEntries.map((e) => e.label),
        values: projectProgressEntries.map((e) => e.value),
      },
      projectManpower: {
        labels: projectManpowerEntries.map((e) => e.label),
        values: projectManpowerEntries.map((e) => e.value),
      },
      engineerActivities: {
        labels: Object.keys(engineerActivityMap),
        values: Object.values(engineerActivityMap),
      },
      sourceDistribution: {
        labels: Object.keys(sourceDistMap),
        values: Object.values(sourceDistMap),
      },
    };
  }

  _buildGroupedReports(reports) {
    return reports.map((r) => {
      // Compute totalManpower from sources[] (new schema), fallback to stored value
      let computedMP = 0;
      (r.items || []).forEach(item => {
        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(src => { computedMP += this._sourceTot(src); });
        } else {
          computedMP += (Number(item.totalManpower) || 0) + (Number(item.externalTotalManpower) || 0);
        }
      });

      return {
        _id: r._id,
        reportId: r.reportId,
        date: r.date,
        engineerName: r.engineerName,
        siteName: r.siteName,
        shiftType: r.shiftType || 'Day',
        startTime: r.startTime || '',
        endTime: r.endTime || '',
        shiftDurationMinutes: r.shiftDurationMinutes || 0,
        itemsCount: r.itemsCount,
        totalManpower: computedMP || (Number(r.totalManpower) || 0),
        averageProgress: r.averageProgress,
        generalComment: r.generalComment,
        generalDelays: r.generalDelays,
        items: r.items,
      };
    });
  }

  _buildTableRows(reports) {
    const rows = [];
    reports.forEach((r) => {
      (r.items || []).forEach((item) => {
        // Compute item manpower from sources[] if available
        let itemMP = 0;
        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(src => { itemMP += this._sourceTot(src); });
        } else {
          itemMP = (Number(item.totalManpower) || 0) + (Number(item.externalTotalManpower) || 0);
        }

        rows.push({
          reportId: r.reportId,
          timestamp: r.createdAt,
          date: r.date,
          engineerName: r.engineerName,
          siteName: r.siteName,
          shiftType: item.shiftType || r.shiftType || '',
          startTime: item.startTime || r.startTime || '',
          endTime: item.endTime || r.endTime || '',
          shiftDurationMinutes: item.shiftDurationMinutes || r.shiftDurationMinutes || 0,
          itemNo: item.itemNo,
          element: item.element,
          level: item.level,
          activity: item.activity,
          progress: item.progress,
          totalManpower: itemMP,
          laborSourceType: item.laborSourceType,
          sourceCompanyName: item.sourceCompanyName,
          sourceScopeNotes: item.sourceScopeNotes,
          itemComment: item.itemComment,
          generalComment: r.generalComment,
          generalDelays: r.generalDelays,
          manpower: item.manpower,
          externalManpower: item.externalManpower,
          externalTotalManpower: item.externalTotalManpower || 0,
          sources: item.sources || [],
        });
      });
    });
    return rows;
  }

  _computeManpowerBreakdown(reports) {
    const bySource   = { 'In-House': 0, 'Supplier': 0, 'Subcontractor': 0 };
    const byTrade    = { steelFixer:0, steelFixerForemen:0, carpenter:0, carpenterForemen:0, helper:0, scaffolding:0, engineersNo:0 };
    const perCompany = {};

    // ── perProject: { [siteName]: { total, inHouse, supplier, subcontractor, perCompany:{} } }
    const perProject = {};

    reports.forEach(r => {
      const site = r.siteName;
      if (!perProject[site]) {
        perProject[site] = {
          total: 0, inHouse: 0, supplier: 0, subcontractor: 0,
          perCompany: {},
        };
      }
      const proj = perProject[site];

      (r.items || []).forEach(i => {
        const sources = this._resolveSources(i);

        sources.forEach(s => {
          const srcType = s.type || 'In-House';
          // FIX: use _sourceTot (prefers s.totalManpower over summing trades)
          const total   = this._sourceTot(s);

          // Global bySource
          bySource[srcType] = (bySource[srcType] || 0) + total;
          this._addTrades(byTrade, s.manpower);

          // Global perCompany
          if ((srcType === 'Supplier' || srcType === 'Subcontractor') && s.companyName) {
            if (!perCompany[s.companyName]) {
              perCompany[s.companyName] = {
                total: 0, type: srcType,
                trades: { steelFixer:0, steelFixerForemen:0, carpenter:0, carpenterForemen:0, helper:0, scaffolding:0, engineersNo:0 },
              };
            }
            perCompany[s.companyName].total += total;
            this._addTrades(perCompany[s.companyName].trades, s.manpower);
          }

          // Per-project totals
          proj.total += total;
          if (srcType === 'In-House')          proj.inHouse      += total;
          else if (srcType === 'Supplier')     proj.supplier     += total;
          else if (srcType === 'Subcontractor') proj.subcontractor += total;

          // Per-project per-company
          if ((srcType === 'Supplier' || srcType === 'Subcontractor') && s.companyName) {
            if (!proj.perCompany[s.companyName]) {
              proj.perCompany[s.companyName] = { total: 0, type: srcType };
            }
            proj.perCompany[s.companyName].total += total;
          }
        });
      });
    });

    const companiesSorted = Object.entries(perCompany)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    // Convert perProject.perCompany maps to sorted arrays
    const perProjectArr = Object.entries(perProject)
      .map(([siteName, data]) => ({
        siteName,
        total:         data.total,
        inHouse:       data.inHouse,
        supplier:      data.supplier,
        subcontractor: data.subcontractor,
        companies: Object.entries(data.perCompany)
          .map(([name, d]) => ({ name, total: d.total, type: d.type }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);

    return { bySource, byTrade, perCompany: companiesSorted, perProject: perProjectArr };
  }

  // ─── Operations Panel ─────────────────────────────────────────────────────
  _computeOperationsPanel(reports) {
    // Build detailed rows: one entry per report-item (project + date + activity + element + level)
    // grouped by project → activity, preserving full trade/source detail

    const projectMap = {}; // projectName → { activities: { actKey → {...} } }

    reports.forEach(r => {
      const proj = r.siteName || '—';
      if (!projectMap[proj]) projectMap[proj] = { name: proj, activities: {} };

      (r.items || []).forEach(i => {
        const actKey = [i.activity || '—', i.element || '—', i.level || '—'].join('||');

        if (!projectMap[proj].activities[actKey]) {
          projectMap[proj].activities[actKey] = {
            activity:      i.activity || '—',
            element:       i.element  || '—',
            level:         i.level    || '—',
            progress:      0,
            progressCount: 0,
            totalWorkers:  0,
            inHouse:       0,
            supplier:      0,
            subcontractor: 0,
            byTrade:       { steelFixer:0, steelFixerForemen:0, carpenter:0, carpenterForemen:0, helper:0, scaffolding:0, engineersNo:0 },
            companies:     {},   // companyName → count
            dateMin:       r.date,
            dateMax:       r.date,
          };
        }

        const a = projectMap[proj].activities[actKey];

        // date range
        if (r.date < a.dateMin) a.dateMin = r.date;
        if (r.date > a.dateMax) a.dateMax = r.date;

        // progress avg
        if (i.progress != null) {
          a.progress      += Number(i.progress) || 0;
          a.progressCount += 1;
        }

        // workers
        const sources = this._resolveSources(i);
        sources.forEach(s => {
          const t   = s.type || 'In-House';
          const tot = this._sourceTot(s);
          a.totalWorkers += tot;
          if (t === 'In-House')           a.inHouse       += tot;
          else if (t === 'Supplier')      a.supplier      += tot;
          else if (t === 'Subcontractor') a.subcontractor += tot;
          if (s.companyName && tot > 0) {
            a.companies[s.companyName] = (a.companies[s.companyName] || 0) + tot;
          }
          this._addTrades(a.byTrade, s.manpower);
        });
      });
    });

    // Flatten to array per project
    const projects = Object.values(projectMap).map(p => {
      const acts = Object.values(p.activities).map(a => ({
        ...a,
        avgProgress: a.progressCount > 0 ? Math.round(a.progress / a.progressCount) : 0,
        companies:   Object.entries(a.companies).map(([name, count]) => ({ name, count })),
      })).sort((a, b) => b.totalWorkers - a.totalWorkers);

      const totWorkers = acts.reduce((s, a) => s + a.totalWorkers, 0);
      return { name: p.name, totalWorkers: totWorkers, activities: acts };
    }).sort((a, b) => b.totalWorkers - a.totalWorkers);

    // Grand totals (kept for backward compat)
    const totals = { totalWorkers: 0, inHouse: 0, supplier: 0, subcontractor: 0,
      byTrade: { steelFixer:0, steelFixerForemen:0, carpenter:0, carpenterForemen:0, helper:0, scaffolding:0, engineersNo:0 } };
    projects.forEach(p => p.activities.forEach(a => {
      totals.totalWorkers  += a.totalWorkers;
      totals.inHouse       += a.inHouse;
      totals.supplier      += a.supplier;
      totals.subcontractor += a.subcontractor;
      Object.keys(totals.byTrade).forEach(t => { totals.byTrade[t] += a.byTrade[t]; });
    }));

    return { projects, totals };
  }
}

module.exports = new DashboardService();