const DailyReport = require('../models/DailyReport');
const { sumMp } = require('../utils/manpowerHelpers');

class ManpowerSummaryService {

  _resolveItemSources(item) {
    const result = { inHouse: 0, supplier: 0, subcontractor: 0 };

    if (item.sources && item.sources.length > 0) {
      item.sources.forEach(s => {
        const tot = Number(s.totalManpower) || sumMp(s.manpower);
        if (s.type === 'In-House')           result.inHouse       += tot;
        else if (s.type === 'Supplier')      result.supplier      += tot;
        else if (s.type === 'Subcontractor') result.subcontractor += tot;
      });
    } else {
      const ihTot = sumMp(item.manpower);
      result.inHouse += ihTot;
      const extType = item.laborSourceType;
      if (extType === 'Supplier' || extType === 'Subcontractor') {
        const extTot = sumMp(item.externalManpower) || (Number(item.externalTotalManpower) || 0);
        if (extType === 'Supplier')      result.supplier      += extTot;
        if (extType === 'Subcontractor') result.subcontractor += extTot;
      }
    }

    return result;
  }

  _toDubaiDate(d) {
    const dubaiMs = new Date(d).getTime() + (4 * 60 * 60 * 1000);
    const dubai   = new Date(dubaiMs);
    const y  = dubai.getUTCFullYear();
    const m  = String(dubai.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dubai.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  async getSummary(filters = {}) {
    const query = {};

    if (filters.fromDate || filters.toDate) {
      query.date = {};
      if (filters.fromDate) query.date.$gte = new Date(filters.fromDate);
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    if (filters.project) {
      const mongoose = require('mongoose');
      try {
        query.site = new mongoose.Types.ObjectId(filters.project);
      } catch (_) {
        query.site = filters.project;
      }
    }

    const reports = await DailyReport.find(query)
      .sort({ date: -1 })
      .limit(1000)
      .lean();

    const siteMap = {};

    reports.forEach(r => {
      const siteName = r.siteName;
      const dateStr  = this._toDubaiDate(r.date);

      if (!siteMap[siteName]) siteMap[siteName] = { days: {} };

      if (!siteMap[siteName].days[dateStr]) {
        siteMap[siteName].days[dateStr] = {
          date:          dateStr,
          inHouse:       0,
          supplier:      0,
          subcontractor: 0,
          engineers:     new Set(),
          reportCount:   0,
        };
      }

      const day = siteMap[siteName].days[dateStr];
      day.engineers.add(r.engineerName);
      day.reportCount++;

      (r.items || []).forEach(item => {
        // ── Activity & Level filters ──
        if (filters.activity && item.activity !== filters.activity) return;
        if (filters.level    && item.level    !== filters.level)    return;

        const src = this._resolveItemSources(item);
        day.inHouse       += src.inHouse;
        day.supplier      += src.supplier;
        day.subcontractor += src.subcontractor;
      });
    });

    const sites = Object.entries(siteMap).map(([siteName, data]) => {
      const days = Object.values(data.days)
        .map(d => ({
          date:          d.date,
          inHouse:       d.inHouse,
          supplier:      d.supplier,
          subcontractor: d.subcontractor,
          total:         d.inHouse + d.supplier + d.subcontractor,
          engineers:     [...d.engineers].sort(),
          reportCount:   d.reportCount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      const totalInHouse       = days.reduce((s, d) => s + d.inHouse,       0);
      const totalSupplier      = days.reduce((s, d) => s + d.supplier,      0);
      const totalSubcontractor = days.reduce((s, d) => s + d.subcontractor, 0);

      return {
        siteName,
        totalInHouse,
        totalSupplier,
        totalSubcontractor,
        grandTotal: totalInHouse + totalSupplier + totalSubcontractor,
        days,
      };
    }).sort((a, b) => b.grandTotal - a.grandTotal);

    return { sites, totalReports: reports.length };
  }

  _emptyTrades() {
    const { MP_FIELDS } = require('../utils/manpowerHelpers');
    return MP_FIELDS.reduce((o, f) => { o[f] = 0; return o; }, {});
  }

  _accTrades(acc, mp) {
    if (!mp) return;
    const { MP_FIELDS } = require('../utils/manpowerHelpers');
    MP_FIELDS.forEach(f => { acc[f] = (acc[f] || 0) + (Number(mp[f]) || 0); });
  }

  async getBreakdown(filters = {}) {
    const { MP_FIELDS } = require('../utils/manpowerHelpers');
    const mongoose = require('mongoose');

    const query = {};

    if (filters.fromDate || filters.toDate) {
      query.date = {};
      if (filters.fromDate) query.date.$gte = new Date(filters.fromDate);
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    if (filters.project) {
      try   { query.site = new mongoose.Types.ObjectId(filters.project); }
      catch (_) { query.site = filters.project; }
    }

    const reports = await DailyReport.find(query)
      .sort({ date: -1 })
      .limit(2000)
      .lean();

    const projectMap = {};

    reports.forEach(r => {
      const siteName = r.siteName;
      if (!projectMap[siteName]) projectMap[siteName] = {};
      const srcMap = projectMap[siteName];

      (r.items || []).forEach(item => {
        // ── Activity & Level filters ──
        if (filters.activity && item.activity !== filters.activity) return;
        if (filters.level    && item.level    !== filters.level)    return;

        if (item.sources && item.sources.length > 0) {
          item.sources.forEach(s => {
            if (filters.sourceType === 'In-House' && s.type !== 'In-House') return;
            if (filters.sourceType === 'External'  && s.type === 'In-House') return;

            const key = s.type === 'In-House'
              ? 'In-House'
              : `${s.type}::${(s.companyName || '').trim() || 'Unknown'}`;

            if (!srcMap[key]) {
              srcMap[key] = {
                type:        s.type,
                companyName: s.type === 'In-House' ? '' : ((s.companyName || '').trim() || 'Unknown'),
                trades:      this._emptyTrades(),
                total:       0,
              };
            }
            this._accTrades(srcMap[key].trades, s.manpower);
            srcMap[key].total += (Number(s.totalManpower) || 0);
          });
        } else {
          const ihMp = item.manpower;
          if (ihMp) {
            if (!filters.sourceType || filters.sourceType === 'all' || filters.sourceType === 'In-House') {
              if (!srcMap['In-House']) {
                srcMap['In-House'] = { type: 'In-House', companyName: '', trades: this._emptyTrades(), total: 0 };
              }
              this._accTrades(srcMap['In-House'].trades, ihMp);
              srcMap['In-House'].total += (Number(item.totalManpower) || sumMp(ihMp));
            }
          }
          const extType = item.laborSourceType;
          if (extType && (extType === 'Supplier' || extType === 'Subcontractor')) {
            if (!filters.sourceType || filters.sourceType === 'all' || filters.sourceType === 'External') {
              const companyName = (item.sourceCompanyName || '').trim() || 'Unknown';
              const key = `${extType}::${companyName}`;
              if (!srcMap[key]) {
                srcMap[key] = { type: extType, companyName, trades: this._emptyTrades(), total: 0 };
              }
              this._accTrades(srcMap[key].trades, item.externalManpower);
              srcMap[key].total += (Number(item.externalTotalManpower) || sumMp(item.externalManpower));
            }
          }
        }
      });
    });

    const TRADE_LABELS = {
      steelFixer:        'Steel Fixer',
      steelFixerForemen: 'Steel Fixer Foreman',
      carpenter:         'Carpenter',
      carpenterForemen:  'Carpenter Foreman',
      helper:            'Helper',
      scaffolding:       'Scaffolding',
      engineersNo:       'Engineer',
    };

    const projects = Object.entries(projectMap).map(([siteName, srcMap]) => {
      const sources = Object.values(srcMap).map(src => {
        const total = MP_FIELDS.reduce((s, f) => s + (src.trades[f] || 0), 0);
        const tradesArr = MP_FIELDS
          .map(f => ({ field: f, label: TRADE_LABELS[f], count: src.trades[f] || 0 }))
          .filter(t => t.count > 0);
        return { ...src, total, tradesArr };
      }).filter(s => s.total > 0);

      sources.sort((a, b) => {
        if (a.type === 'In-House') return -1;
        if (b.type === 'In-House') return  1;
        return a.type.localeCompare(b.type) || a.companyName.localeCompare(b.companyName);
      });

      const grandTotal = sources.reduce((s, src) => s + src.total, 0);
      return { siteName, grandTotal, sources };
    }).filter(p => p.grandTotal > 0)
      .sort((a, b) => b.grandTotal - a.grandTotal);

    return { projects, totalReports: reports.length, tradeLabels: TRADE_LABELS };
  }

}

module.exports = new ManpowerSummaryService();
