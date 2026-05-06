const Project    = require('../models/Project');
const DailyReport = require('../models/DailyReport');
const logger     = require('../utils/logger');

exports.showProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({}).sort({ isActive: -1, name: 1 }).lean();

    // For each project get quick stats
    const stats = await Promise.all(projects.map(async p => {
      const count = await DailyReport.countDocuments({ site: p._id });
      const last  = await DailyReport.findOne({ site: p._id }).sort({ date: -1 }).lean();
      return {
        _id:          p._id,
        name:         p.name,
        code:         p.code || '',
        location:     p.location || '',
        isActive:     p.isActive,
        levelsCount:  (p.levels || []).filter(l => l.isActive).length,
        totalReports: count,
        lastDate:     last ? new Date(last.date).toISOString().slice(0, 10) : null,
      };
    }));

    res.render('admin/projects', {
      title: 'Projects',
      projects: stats,
    });
  } catch (err) {
    logger.error('showProjects error:', err);
    next(err);
  }
};

exports.showTimeline = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) {
      req.flash('error', 'Project not found.');
      return res.redirect('/admin/dashboard');
    }

    // ── Query filters from URL params ─────────────────────────────────────
    const { fromDate, toDate, element: fElement, level: fLevel, activity: fActivity } = req.query;

    const query = { site: project._id };
    if (fromDate) query.date = { ...query.date, $gte: new Date(fromDate) };
    if (toDate)   query.date = { ...query.date, $lte: new Date(toDate + 'T23:59:59') };

    const reports = await DailyReport.find(query).sort({ date: 1 }).lean();

    // Safe UTC date string — avoids timezone shifting
    // Convert date to Dubai local date string (UTC+4)
    // MongoDB stores dates in UTC — a report submitted on Apr 7 in Dubai
    // is stored as Apr 6 22:00 UTC, so getUTCDate() would return 6, not 7.
    function toDateStr(d) {
      const dt = new Date(d);
      // Offset to Dubai time (UTC+4) — add 4 hours
      const dubaiMs = dt.getTime() + (4 * 60 * 60 * 1000);
      const dubai   = new Date(dubaiMs);
      const y  = dubai.getUTCFullYear();
      const m  = String(dubai.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dubai.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }

    // ── Build Gantt: key → { per-day progress (max), per-day manpower } ──
    // Structure: activityMap[key].days[dateStr] = { progress, manpower, engineers }
    const activityMap = {};

    reports.forEach(r => {
      const dateStr = toDateStr(r.date);
      (r.items || []).forEach(item => {
        // Apply item-level filters
        if (fElement  && item.element  !== fElement)  return;
        if (fLevel    && item.level    !== fLevel)    return;
        if (fActivity && item.activity !== fActivity) return;

        const key = [item.activity, item.element, item.level].join('||');
        if (!activityMap[key]) {
          activityMap[key] = {
            key,
            activity: item.activity,
            element:  item.element,
            level:    item.level,
            days: {},           // dateStr → { progress, manpower, engineers[] }
            totalManpower: 0,
          };
        }
        const a = activityMap[key];

        // Per-day: keep highest progress for same combo on same day
        const prev = a.days[dateStr];
        const prog = item.progress || 0;
        // Compute manpower from sources array (more reliable than item.totalManpower)
        const mp = (() => {
          if (item.sources && item.sources.length > 0) {
            return item.sources.reduce((sum, s) => {
              const pre = Number(s.totalManpower);
              if (pre > 0) return sum + pre;
              // fallback: sum trades
              const mp2 = s.manpower || {};
              return sum + (mp2.steelFixer||0) + (mp2.steelFixerForemen||0) +
                (mp2.carpenter||0) + (mp2.carpenterForemen||0) +
                (mp2.helper||0) + (mp2.scaffolding||0) + (mp2.engineersNo||0);
            }, 0);
          }
          // Legacy: use item.totalManpower or sum flat manpower
          if (item.totalManpower > 0) return item.totalManpower;
          const m = item.manpower || {};
          const ext = item.externalManpower || {};
          return (m.steelFixer||0)+(m.steelFixerForemen||0)+(m.carpenter||0)+
            (m.carpenterForemen||0)+(m.helper||0)+(m.scaffolding||0)+(m.engineersNo||0)+
            (ext.steelFixer||0)+(ext.steelFixerForemen||0)+(ext.carpenter||0)+
            (ext.carpenterForemen||0)+(ext.helper||0)+(ext.scaffolding||0)+(ext.engineersNo||0);
        })();

        if (!prev || prog > prev.progress) {
          a.days[dateStr] = {
            progress:   prog,
            manpower:   mp,
            engineers:  prev ? [...new Set([...prev.engineers, r.engineerName])] : [r.engineerName],
          };
        } else {
          // Keep existing progress but accumulate engineers
          a.days[dateStr].engineers = [...new Set([...a.days[dateStr].engineers, r.engineerName])];
          a.days[dateStr].manpower  = Math.max(a.days[dateStr].manpower, mp);
        }

        a.totalManpower += mp;
      });
    });

    // Convert to array, compute firstDate / lastDate / daysActive from days keys
    const ganttItems = Object.values(activityMap).map(a => {
      const dayKeys = Object.keys(a.days).sort();
      return {
        key:          a.key,
        activity:     a.activity,
        element:      a.element,
        level:        a.level,
        firstDate:    dayKeys[0] || null,
        lastDate:     dayKeys[dayKeys.length - 1] || null,
        latestProgress: a.days[dayKeys[dayKeys.length - 1]]?.progress || 0,
        totalManpower: a.totalManpower,
        daysActive:   dayKeys.length,
        days:         a.days,   // { dateStr: { progress, manpower, engineers[] } }
      };
    }).sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));

    // ── Build daily log ───────────────────────────────────────────────────
    const dailyMap = {};
    reports.forEach(r => {
      const dateStr = toDateStr(r.date);
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, entries: [] };
      const filteredItems = (r.items || []).filter(i => {
        if (fElement  && i.element  !== fElement)  return false;
        if (fLevel    && i.level    !== fLevel)    return false;
        if (fActivity && i.activity !== fActivity) return false;
        return true;
      });
      if (filteredItems.length === 0 && (fElement || fLevel || fActivity)) return;
      dailyMap[dateStr].entries.push({
        reportId:        r.reportId,
        engineerName:    r.engineerName,
        shiftType:       r.shiftType || 'Day',
        startTime:       r.startTime || '',
        endTime:         r.endTime   || '',
 totalManpower: (() => {
  const its = (r.items || []).filter(i => {
    if (fElement  && i.element  !== fElement)  return false;
    if (fLevel    && i.level    !== fLevel)    return false;
    if (fActivity && i.activity !== fActivity) return false;
    return true;
  });
  return its.reduce((total, i) => {
    if (i.sources && i.sources.length > 0) {
      return total + i.sources.reduce((s, src) => {
        const pre = Number(src.totalManpower);
        if (pre > 0) return s + pre;
        const mp = src.manpower || {};
        return s + (mp.steelFixer||0)+(mp.steelFixerForemen||0)+(mp.carpenter||0)+
          (mp.carpenterForemen||0)+(mp.helper||0)+(mp.scaffolding||0)+(mp.engineersNo||0);
      }, 0);
    }
    if (i.totalManpower > 0) return total + i.totalManpower;
    const m = i.manpower || {};
    const ext = i.externalManpower || {};
    return total + (m.steelFixer||0)+(m.steelFixerForemen||0)+(m.carpenter||0)+
      (m.carpenterForemen||0)+(m.helper||0)+(m.scaffolding||0)+(m.engineersNo||0)+
      (ext.steelFixer||0)+(ext.steelFixerForemen||0)+(ext.carpenter||0)+
      (ext.carpenterForemen||0)+(ext.helper||0)+(ext.scaffolding||0)+(ext.engineersNo||0);
  }, 0);
})(),
        averageProgress: r.averageProgress || 0,
        generalComment:  r.generalComment || '',
        generalDelays:   r.generalDelays  || '',
        items: filteredItems.map(i => ({
          activity:      i.activity,
          element:       i.element,
          level:         i.level,
          progress:      i.progress,
          totalManpower: i.totalManpower || 0,
          sources: (i.sources || []).map(s => ({
            type:          s.type,
            companyName:   s.companyName || '',
            totalManpower: s.totalManpower || 0,
          })),
          itemComment: i.itemComment || '',
        })),
      });
    });
    const dailyDays = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    // ── Date range ────────────────────────────────────────────────────────
    // Use filtered range when filters active, otherwise full project range
    let minDate, maxDate;
    if (ganttItems.length > 0) {
      // Derive from the actual gantt items' days
      const allDayKeys = ganttItems.flatMap(g => Object.keys(g.days)).sort();
      minDate = allDayKeys[0] || null;
      maxDate = allDayKeys[allDayKeys.length - 1] || null;
    } else {
      const allReports2 = await DailyReport.find({ site: project._id })
        .select('date').sort({ date: 1 }).lean();
      const allDates2 = allReports2.map(r => toDateStr(r.date));
      minDate = allDates2[0] || null;
      maxDate = allDates2[allDates2.length - 1] || null;
    }

    // Also compute full project date range for the header display
    const allReports = await DailyReport.find({ site: project._id })
      .select('date').sort({ date: 1 }).lean();
    const allDates = allReports.map(r => toDateStr(r.date));
    const projectMinDate = allDates[0] || null;
    const projectMaxDate = allDates[allDates.length - 1] || null;

    // ── Filter options (unique values across all reports) ─────────────────
    const allItems = allReports.length
      ? (await DailyReport.find({ site: project._id }).select('items.element items.level items.activity').lean())
          .flatMap(r => r.items || [])
      : [];
    const filterOptions = {
      elements:   [...new Set(allItems.map(i => i.element).filter(Boolean))].sort(),
      levels:     [...new Set(allItems.map(i => i.level).filter(Boolean))].sort(),
      activities: [...new Set(allItems.map(i => i.activity).filter(Boolean))].sort(),
    };

    res.render('admin/project-timeline', {
      title: `${project.name} — Timeline`,
      project,
      ganttItems,
      dailyDays,
      minDate,
      maxDate,
      projectMinDate,
      projectMaxDate,
      totalReports: reports.length,
      filterOptions,
      activeFilters: { fromDate: fromDate || '', toDate: toDate || '', element: fElement || '', level: fLevel || '', activity: fActivity || '' },
    });
  } catch (err) {
    logger.error('Timeline error:', err);
    next(err);
  }
};
