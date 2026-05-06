const ExcelJS = require('exceljs');
const { formatDate, formatDateTime } = require('../utils/dateHelpers');
const { sumMp, emptyMp, addMp } = require('../utils/manpowerHelpers');

// ── Local aliases (keep internal callers working) ─────────────────────────────
const _sumMp   = sumMp;
const _emptyMp = emptyMp;
const _addMp   = addMp;

/**
 * Resolve a tableRow's manpower data into { inHouse, external[] } regardless
 * of whether it came from the new sources[] schema or the legacy flat fields.
 *
 * Returns:
 *   inHouse  — manpower object for In-House workers
 *   external — array of { type, companyName, scopeNotes, manpower, total }
 *   totalManpower — grand total
 */
function _resolveManpower(row) {
  const inHouse = _emptyMp();
  const external = [];

  // ── New schema: sources[] attached directly on the row (tableRows in
  //    dashboardService._buildTableRows don't include sources[], so we check
  //    if the caller passed them via row.sources)
  if (row.sources && row.sources.length > 0) {
    row.sources.forEach((s) => {
      const tot = Number(s.totalManpower) || _sumMp(s.manpower);
      if (s.type === 'In-House') {
        _addMp(inHouse, s.manpower);
      } else {
        external.push({
          type:        s.type || '',
          companyName: s.companyName || '',
          scopeNotes:  s.scopeNotes || '',
          manpower:    s.manpower || _emptyMp(),
          total:       tot,
        });
      }
    });
  } else {
    // ── Legacy flat fields ──
    _addMp(inHouse, row.manpower);
    const extTot = _sumMp(row.externalManpower) || (Number(row.externalTotalManpower) || 0);
    if (extTot > 0 || row.sourceCompanyName) {
      external.push({
        type:        row.laborSourceType || '',
        companyName: row.sourceCompanyName || '',
        scopeNotes:  row.sourceScopeNotes || '',
        manpower:    row.externalManpower || _emptyMp(),
        total:       extTot,
      });
    }
  }

  const totalManpower = row.totalManpower ||
    (_sumMp(inHouse) + external.reduce((s, e) => s + e.total, 0));

  return { inHouse, external, totalManpower };
}

// ─────────────────────────────────────────────────────────────────────────────

class ExcelService {
  async generateReport(tableRows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AGILEPRIME';
    workbook.created = new Date();

    // ── Sheet 1: Summary (one row per item, collapsed manpower totals) ────────
    const ws = workbook.addWorksheet('Daily Reports', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'Report ID',            key: 'reportId',             width: 22 },
      { header: 'Timestamp',            key: 'timestamp',            width: 20 },
      { header: 'Date',                 key: 'date',                 width: 14 },
      { header: 'Engineer',             key: 'engineerName',         width: 20 },
      { header: 'Site',                 key: 'siteName',             width: 24 },
      { header: 'Shift',               key: 'shiftType',            width: 10 },
      { header: 'Start Time',          key: 'startTime',            width: 12 },
      { header: 'End Time',            key: 'endTime',              width: 12 },
      { header: 'Duration (min)',       key: 'shiftDurationMinutes', width: 15 },
      { header: 'Item No',             key: 'itemNo',               width: 10 },
      { header: 'Element',             key: 'element',              width: 18 },
      { header: 'Level',               key: 'level',                width: 16 },
      { header: 'Activity',            key: 'activity',             width: 20 },
      { header: 'Progress %',          key: 'progress',             width: 12 },
      { header: 'Item Comment',        key: 'itemComment',          width: 24 },
      // ── In-House manpower ──
      { header: 'IH Steel Fixer',      key: 'ihSteelFixer',         width: 14 },
      { header: 'IH SF Foremen',       key: 'ihSteelFixerForemen',  width: 14 },
      { header: 'IH Carpenter',        key: 'ihCarpenter',          width: 14 },
      { header: 'IH Carp Foremen',     key: 'ihCarpenterForemen',   width: 16 },
      { header: 'IH Helper',           key: 'ihHelper',             width: 11 },
      { header: 'IH Scaffolding',      key: 'ihScaffolding',        width: 14 },
      { header: 'IH Engineers',        key: 'ihEngineersNo',        width: 14 },
      { header: 'IH Total',            key: 'ihTotal',              width: 10 },
      // ── External manpower (first external source, covers most cases) ──
      { header: 'Ext. Type',           key: 'extType',              width: 16 },
      { header: 'Ext. Company',        key: 'extCompany',           width: 22 },
      { header: 'Ext. Scope/Notes',    key: 'extScopeNotes',        width: 22 },
      { header: 'Ext. Steel Fixer',    key: 'extSteelFixer',        width: 14 },
      { header: 'Ext. SF Foremen',     key: 'extSteelFixerForemen', width: 14 },
      { header: 'Ext. Carpenter',      key: 'extCarpenter',         width: 14 },
      { header: 'Ext. Carp Foremen',   key: 'extCarpenterForemen',  width: 16 },
      { header: 'Ext. Helper',         key: 'extHelper',            width: 11 },
      { header: 'Ext. Scaffolding',    key: 'extScaffolding',       width: 14 },
      { header: 'Ext. Engineers',      key: 'extEngineersNo',       width: 14 },
      { header: 'Ext. Total',          key: 'extTotal',             width: 10 },
      // ── Totals ──
      { header: 'Total Manpower',      key: 'totalManpower',        width: 16 },
      { header: 'General Comment',     key: 'generalComment',       width: 26 },
      { header: 'General Delays',      key: 'generalDelays',        width: 26 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height    = 28;

    // Populate data rows
    tableRows.forEach((row) => {
      const { inHouse, external, totalManpower } = _resolveManpower(row);
      const ext = external[0] || {};   // first external source (covers the vast majority of cases)
      const extMp = ext.manpower || _emptyMp();

      ws.addRow({
        reportId:             row.reportId,
        timestamp:            formatDateTime(row.timestamp),
        date:                 formatDate(row.date),
        engineerName:         row.engineerName,
        siteName:             row.siteName,
        shiftType:            row.shiftType || '',
        startTime:            row.startTime || '',
        endTime:              row.endTime || '',
        shiftDurationMinutes: row.shiftDurationMinutes || 0,
        itemNo:               row.itemNo,
        element:              row.element,
        level:                row.level,
        activity:             row.activity,
        progress:             row.progress,
        itemComment:          row.itemComment || '',
        // In-House
        ihSteelFixer:        inHouse.steelFixer,
        ihSteelFixerForemen: inHouse.steelFixerForemen,
        ihCarpenter:         inHouse.carpenter,
        ihCarpenterForemen:  inHouse.carpenterForemen,
        ihHelper:            inHouse.helper,
        ihScaffolding:       inHouse.scaffolding,
        ihEngineersNo:       inHouse.engineersNo,
        ihTotal:             _sumMp(inHouse),
        // External (first source)
        extType:             ext.type || '',
        extCompany:          ext.companyName || '',
        extScopeNotes:       ext.scopeNotes || '',
        extSteelFixer:       extMp.steelFixer || 0,
        extSteelFixerForemen:extMp.steelFixerForemen || 0,
        extCarpenter:        extMp.carpenter || 0,
        extCarpenterForemen: extMp.carpenterForemen || 0,
        extHelper:           extMp.helper || 0,
        extScaffolding:      extMp.scaffolding || 0,
        extEngineersNo:      extMp.engineersNo || 0,
        extTotal:            ext.total || 0,
        // Totals
        totalManpower,
        generalComment:      row.generalComment || '',
        generalDelays:       row.generalDelays || '',
      });
    });

    // ── Sheet 2: Sources Detail (one row per source per item — handles multi-source) ──
    const ws2 = workbook.addWorksheet('Sources Detail', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws2.columns = [
      { header: 'Report ID',    key: 'reportId',   width: 22 },
      { header: 'Date',         key: 'date',        width: 14 },
      { header: 'Engineer',     key: 'engineerName',width: 20 },
      { header: 'Site',         key: 'siteName',    width: 24 },
      { header: 'Item No',      key: 'itemNo',      width: 10 },
      { header: 'Element',      key: 'element',     width: 18 },
      { header: 'Level',        key: 'level',       width: 16 },
      { header: 'Activity',     key: 'activity',    width: 20 },
      { header: 'Source Type',  key: 'sourceType',  width: 16 },
      { header: 'Company',      key: 'companyName', width: 22 },
      { header: 'Scope/Notes',  key: 'scopeNotes',  width: 22 },
      { header: 'Steel Fixer',  key: 'steelFixer',  width: 12 },
      { header: 'SF Foremen',   key: 'steelFixerForemen', width: 14 },
      { header: 'Carpenter',    key: 'carpenter',   width: 12 },
      { header: 'Carp Foremen', key: 'carpenterForemen',  width: 16 },
      { header: 'Helper',       key: 'helper',      width: 10 },
      { header: 'Scaffolding',  key: 'scaffolding', width: 12 },
      { header: 'Engineers',    key: 'engineersNo', width: 12 },
      { header: 'Total',        key: 'total',       width: 10 },
    ];

    const headerRow2 = ws2.getRow(1);
    headerRow2.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow2.height    = 28;

    tableRows.forEach((row) => {
      const { inHouse, external } = _resolveManpower(row);

      // In-House row
      ws2.addRow({
        reportId: row.reportId, date: formatDate(row.date),
        engineerName: row.engineerName, siteName: row.siteName,
        itemNo: row.itemNo, element: row.element, level: row.level, activity: row.activity,
        sourceType: 'In-House', companyName: '', scopeNotes: '',
        steelFixer: inHouse.steelFixer, steelFixerForemen: inHouse.steelFixerForemen,
        carpenter: inHouse.carpenter, carpenterForemen: inHouse.carpenterForemen,
        helper: inHouse.helper, scaffolding: inHouse.scaffolding, engineersNo: inHouse.engineersNo,
        total: _sumMp(inHouse),
      });

      // One row per external source
      external.forEach((src) => {
        const mp = src.manpower || _emptyMp();
        ws2.addRow({
          reportId: row.reportId, date: formatDate(row.date),
          engineerName: row.engineerName, siteName: row.siteName,
          itemNo: row.itemNo, element: row.element, level: row.level, activity: row.activity,
          sourceType: src.type, companyName: src.companyName, scopeNotes: src.scopeNotes,
          steelFixer: mp.steelFixer, steelFixerForemen: mp.steelFixerForemen,
          carpenter: mp.carpenter, carpenterForemen: mp.carpenterForemen,
          helper: mp.helper, scaffolding: mp.scaffolding, engineersNo: mp.engineersNo,
          total: src.total,
        });
      });
    });

    // ── Apply styling to both sheets ──────────────────────────────────────────
    [ws, ws2].forEach((sheet) => {
      sheet.eachRow((row, rowNum) => {
        if (rowNum > 1 && rowNum % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          });
        }
        if (rowNum > 1) {
          row.alignment = { vertical: 'middle', wrapText: true };
        }
        row.eachCell((cell) => {
          cell.border = {
            top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });
    });

    return workbook;
  }
}

module.exports = new ExcelService();
