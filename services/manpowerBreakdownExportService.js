'use strict';

/**
 * Manpower Breakdown Export Service
 * Generates professional Excel (ExcelJS) and PDF (PDFKit) exports
 * for the Manpower Breakdown page.
 */

const ExcelJS = require('exceljs');
const path    = require('path');

// ── PDF palette (dark navy/gold) ────────────────────────────────────────────
const C = {
  navyDeep:   '0A0F1E',
  navyMid:    '0D1526',
  navyPanel:  '111827',
  navyBorder: '1E2D45',
  gold:       'C9A84C',
  goldLight:  'E8C87A',
  goldDim:    '8B6F2E',
  white:      'FFFFFF',
  textPri:    'F0F4FF',
  textSec:    '8B9BB4',
  emerald:    '34D399',
  emeraldDim: '064E3B',
  blue:       '60A5FA',
  blueDim:    '1E3A5F',
  pink:       'F472B6',
  pinkDim:    '4A1942',
  yellow:     'FCD34D',
  rowAlt:     '0F1A2E',
  rowBase:    '0D1526',
};

// ── Excel palette (light, professional corporate) ───────────────────────────
const XL = {
  hdrBg:      '1F3864',  // deep navy header band
  hdrFg:      'FFFFFF',  // white text
  hdrGold:    'C9A84C',  // gold accent in header
  subHdrBg:   'D6DCE4',  // blue-grey section titles
  subHdrFg:   '1F3864',
  rowOdd:     'FFFFFF',
  rowEven:    'F2F5FA',
  textMain:   '1A1A2E',
  textMuted:  '6B7280',
  totalBg:    '1F3864',
  totalFg:    'FFFFFF',
  goldAccent: 'C9A84C',
  ihFg:       '065F46',
  ihBg:       'D1FAE5',
  supFg:      '1E40AF',
  supBg:      'DBEAFE',
  subFg:      '9D174D',
  subBg:      'FCE7F3',
  numHi:      '1F3864',
  numZero:    'D1D5DB',
  border:     'CBD5E1',
  borderDark: '94A3B8',
  subtBg:     'EFF3FA',
  subtFg:     '1F3864',
  subtGold:   'B45309',
};

// ── Trade label map ─────────────────────────────────────────────────────────
const TRADE_LABELS = {
  steelFixer:        'Steel Fixer',
  steelFixerForemen: 'Steel Fixer Foreman',
  carpenter:         'Carpenter',
  carpenterForemen:  'Carpenter Foreman',
  helper:            'Helper',
  scaffolding:       'Scaffolding',
  engineersNo:       'Engineer',
};
const TRADE_FIELDS = Object.keys(TRADE_LABELS);

// ── Cell helper ─────────────────────────────────────────────────────────────
function cell(ws, col, row) { return ws.getCell(`${col}${row}`); }

function applyBorder(ws, col, row, sides = 'all', color = C.navyBorder) {
  const borderDef = { style: 'thin', color: { argb: 'FF' + color } };
  const c = ws.getCell(`${col}${row}`);
  const border = {};
  if (sides === 'all' || sides === 'top')    border.top    = borderDef;
  if (sides === 'all' || sides === 'bottom') border.bottom = borderDef;
  if (sides === 'all' || sides === 'left')   border.left   = borderDef;
  if (sides === 'all' || sides === 'right')  border.right  = borderDef;
  c.border = { ...(c.border || {}), ...border };
}

function fillCell(ws, col, row, bgArgb, fgArgb, value, bold = false, size = 10, align = 'left', wrap = false, numFmt = null) {
  const c = ws.getCell(`${col}${row}`);
  if (bgArgb) c.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgArgb } };
  if (fgArgb) c.font   = { name: 'Calibri', size, bold, color: { argb: 'FF' + fgArgb } };
  c.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap };
  if (value !== undefined) c.value = value;
  if (numFmt) c.numFmt = numFmt;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EXCEL EXPORT  — light / professional corporate theme
// ═══════════════════════════════════════════════════════════════════════════
async function generateExcel(data, filters = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Agile Prime — SitePulse';
  wb.created  = new Date();
  wb.modified = new Date();
  wb.company  = 'Agile Prime General Contracting L.L.C.';

  const { projects = [], totalReports = 0 } = data;

  // ── Shared helpers for light theme ─────────────────────────────────────
  const bdr = (color = XL.border) => ({
    top:    { style: 'thin', color: { argb: 'FF' + color } },
    bottom: { style: 'thin', color: { argb: 'FF' + color } },
    left:   { style: 'thin', color: { argb: 'FF' + color } },
    right:  { style: 'thin', color: { argb: 'FF' + color } },
  });
  const bdrBottom = (color = XL.border) => ({
    bottom: { style: 'thin', color: { argb: 'FF' + color } },
  });
  const bdrTop = (color = XL.border) => ({
    top: { style: 'thin', color: { argb: 'FF' + color } },
  });
  const bdrTopBottom = (color = XL.border) => ({
    top:    { style: 'thin', color: { argb: 'FF' + color } },
    bottom: { style: 'thin', color: { argb: 'FF' + color } },
  });

  function xlFill(ws, col, row, opts = {}) {
    const c = ws.getCell(`${col}${row}`);
    if (opts.bg)    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.bg } };
    if (opts.fg)    c.font      = { name: 'Calibri', size: opts.sz || 10, bold: !!opts.bold, color: { argb: 'FF' + opts.fg } };
    if (opts.align) c.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: !!opts.wrap };
    else            c.alignment = { horizontal: 'left',     vertical: 'middle', wrapText: !!opts.wrap };
    if (opts.val !== undefined) c.value = opts.val;
    if (opts.border) c.border = opts.border;
    return c;
  }

  const dateRange = [
    filters.fromDate ? `From: ${filters.fromDate}` : '',
    filters.toDate   ? `To: ${filters.toDate}`     : '',
  ].filter(Boolean).join('    ');

  // ── Source type helpers ─────────────────────────────────────────────────
  const srcFg  = t => t === 'In-House' ? XL.ihFg  : t === 'Supplier' ? XL.supFg  : XL.subFg;
  const srcBg  = t => t === 'In-House' ? XL.ihBg  : t === 'Supplier' ? XL.supBg  : XL.subBg;

  // ══════════════════════════════════════════════════════════════════════
  //  SHEET 1 — Overview
  // ══════════════════════════════════════════════════════════════════════
  const wsOv = wb.addWorksheet('Overview', {
    views: [{ state: 'frozen', ySplit: 6 }],
    properties: { tabColor: { argb: 'FF' + XL.hdrBg } },
  });
  wsOv.columns = [
    { key: 'A', width: 5  },
    { key: 'B', width: 34 },
    { key: 'C', width: 17 },
    { key: 'D', width: 17 },
    { key: 'E', width: 17 },
    { key: 'F', width: 17 },
  ];

  // Row 1 — company banner (navy + gold text)
  wsOv.mergeCells('A1:F1');
  xlFill(wsOv, 'A', 1, { bg: XL.hdrBg, fg: XL.hdrGold, val: 'AGILE PRIME GENERAL CONTRACTING L.L.C.', bold: true, sz: 14, align: 'center' });
  wsOv.getRow(1).height = 38;

  // Row 2 — report title
  wsOv.mergeCells('A2:F2');
  xlFill(wsOv, 'A', 2, { bg: XL.hdrBg, fg: XL.hdrFg, val: 'SitePulse  ·  Manpower Breakdown Report', sz: 10, align: 'center' });
  wsOv.getRow(2).height = 20;

  // Row 3 — date / generated meta
  wsOv.mergeCells('A3:D3');
  xlFill(wsOv, 'A', 3, { bg: XL.subHdrBg, fg: XL.subHdrFg, val: dateRange || ('All Dates  ·  ' + new Date().toLocaleDateString('en-AE', { year:'numeric', month:'long', day:'numeric' })), sz: 9, align: 'left', border: bdrBottom() });
  wsOv.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsOv.mergeCells('E3:F3');
  xlFill(wsOv, 'E', 3, { bg: XL.subHdrBg, fg: XL.textMuted, val: `Generated: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}`, sz: 8, align: 'right', border: bdrBottom() });
  wsOv.getRow(3).height = 18;

  // Row 4 — stats bar
  wsOv.mergeCells('A4:B4');
  xlFill(wsOv, 'A', 4, { bg: XL.subHdrBg, fg: XL.textMuted, val: `${projects.length} Projects  ·  ${totalReports} Reports Processed`, sz: 9, align: 'left', border: bdrBottom() });
  wsOv.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsOv.mergeCells('C4:F4');
  const totAllForMeta = projects.reduce((s, p) => s + p.grandTotal, 0);
  xlFill(wsOv, 'C', 4, { bg: XL.subHdrBg, fg: XL.subHdrFg, val: `Grand Total: ${totAllForMeta} Workers`, bold: true, sz: 9, align: 'right', border: bdrBottom() });
  wsOv.getRow(4).height = 18;

  // Row 5 — spacer
  wsOv.mergeCells('A5:F5');
  wsOv.getRow(5).height = 4;

  // Row 6 — column headers
  const ovHdrs = ['#', 'Project / Site', 'In-House', 'Supplier', 'Subcontractor', 'Grand Total'];
  ['A','B','C','D','E','F'].forEach((col, i) => {
    xlFill(wsOv, col, 6, {
      bg: XL.hdrBg, fg: i === 5 ? XL.hdrGold : XL.hdrFg,
      val: ovHdrs[i], bold: true, sz: 9,
      align: i > 1 ? 'center' : (i === 0 ? 'center' : 'left'),
      border: bdrBottom(XL.hdrGold),
    });
  });
  wsOv.getRow(6).height = 24;

  // Data rows
  let ovRow = 7;
  projects.forEach((proj, pi) => {
    let ihT = 0, supT = 0, subT = 0;
    proj.sources.forEach(s => {
      if      (s.type === 'In-House')      ihT  += s.total;
      else if (s.type === 'Supplier')       supT += s.total;
      else                                  subT += s.total;
    });
    const bg = pi % 2 === 0 ? XL.rowOdd : XL.rowEven;
    const bdrOpts = bdrBottom();

    xlFill(wsOv, 'A', ovRow, { bg, fg: XL.textMuted, val: pi + 1, sz: 9, align: 'center', border: bdrOpts });
    xlFill(wsOv, 'B', ovRow, { bg, fg: XL.textMain, val: proj.siteName, bold: true, sz: 10, border: bdrOpts });
    wsOv.getCell(`B${ovRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    xlFill(wsOv, 'C', ovRow, { bg: ihT  > 0 ? XL.ihBg  : bg, fg: ihT  > 0 ? XL.ihFg  : XL.numZero, val: ihT  || '—', bold: ihT  > 0, sz: 10, align: 'center', border: bdrOpts });
    xlFill(wsOv, 'D', ovRow, { bg: supT > 0 ? XL.supBg : bg, fg: supT > 0 ? XL.supFg : XL.numZero, val: supT || '—', bold: supT > 0, sz: 10, align: 'center', border: bdrOpts });
    xlFill(wsOv, 'E', ovRow, { bg: subT > 0 ? XL.subBg : bg, fg: subT > 0 ? XL.subFg : XL.numZero, val: subT || '—', bold: subT > 0, sz: 10, align: 'center', border: bdrOpts });
    xlFill(wsOv, 'F', ovRow, { bg, fg: XL.numHi, val: proj.grandTotal, bold: true, sz: 11, align: 'center', border: bdrOpts });
    wsOv.getRow(ovRow).height = 22;
    ovRow++;
  });

  // Totals row
  const tIH  = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'In-House').reduce((a, x) => a + x.total, 0), 0);
  const tSup = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'Supplier').reduce((a, x) => a + x.total, 0), 0);
  const tSub = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'Subcontractor').reduce((a, x) => a + x.total, 0), 0);
  const tAll = tIH + tSup + tSub;

  wsOv.mergeCells(`A${ovRow}:B${ovRow}`);
  xlFill(wsOv, 'A', ovRow, { bg: XL.totalBg, fg: XL.hdrFg, val: 'GRAND TOTAL', bold: true, sz: 10, align: 'center', border: bdrTopBottom(XL.hdrGold) });
  xlFill(wsOv, 'C', ovRow, { bg: XL.ihBg,  fg: XL.ihFg,  val: tIH,  bold: true, sz: 11, align: 'center', border: bdrTopBottom(XL.hdrGold) });
  xlFill(wsOv, 'D', ovRow, { bg: XL.supBg, fg: XL.supFg, val: tSup, bold: true, sz: 11, align: 'center', border: bdrTopBottom(XL.hdrGold) });
  xlFill(wsOv, 'E', ovRow, { bg: XL.subBg, fg: XL.subFg, val: tSub, bold: true, sz: 11, align: 'center', border: bdrTopBottom(XL.hdrGold) });
  xlFill(wsOv, 'F', ovRow, { bg: XL.hdrBg, fg: XL.hdrGold, val: tAll, bold: true, sz: 13, align: 'center', border: bdrTopBottom(XL.hdrGold) });
  wsOv.getRow(ovRow).height = 28;


  // ══════════════════════════════════════════════════════════════════════
  //  SHEET 2 — Trade Breakdown (all projects)
  // ══════════════════════════════════════════════════════════════════════
  const wsTB = wb.addWorksheet('Trade Breakdown', {
    views: [{ state: 'frozen', ySplit: 7 }],
    properties: { tabColor: { argb: 'FF' + XL.ihFg } },
  });

  const totalCols    = 3 + TRADE_FIELDS.length + 1;
  const lastColLetter = String.fromCharCode(65 + totalCols - 1);

  wsTB.columns = [
    { key: 'A', width: 30 },
    { key: 'B', width: 18 },
    { key: 'C', width: 24 },
    ...TRADE_FIELDS.map(() => ({ width: 15 })),
    { width: 13 },
  ].map((c, i) => ({ ...c, key: String.fromCharCode(65 + i) }));

  // Banner
  wsTB.mergeCells(`A1:${lastColLetter}1`);
  xlFill(wsTB, 'A', 1, { bg: XL.hdrBg, fg: XL.hdrGold, val: 'AGILE PRIME GENERAL CONTRACTING L.L.C.', bold: true, sz: 14, align: 'center' });
  wsTB.getRow(1).height = 38;

  wsTB.mergeCells(`A2:${lastColLetter}2`);
  xlFill(wsTB, 'A', 2, { bg: XL.hdrBg, fg: XL.hdrFg, val: 'SitePulse  ·  Trade-Level Manpower Breakdown', sz: 10, align: 'center' });
  wsTB.getRow(2).height = 20;

  wsTB.mergeCells(`A3:${lastColLetter}3`);
  xlFill(wsTB, 'A', 3, { bg: XL.subHdrBg, fg: XL.subHdrFg, val: dateRange || 'All Dates', sz: 9, align: 'center', border: bdrBottom() });
  wsTB.getRow(3).height = 18;

  wsTB.mergeCells(`A4:${lastColLetter}4`);
  xlFill(wsTB, 'A', 4, { bg: XL.subHdrBg, fg: XL.textMuted,
    val: `Generated: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}   ·   ${projects.length} Projects   ·   ${totalReports} Reports`,
    sz: 8, align: 'center', border: bdrBottom() });
  wsTB.getRow(4).height = 16;

  // spacer
  wsTB.mergeCells(`A5:${lastColLetter}5`);
  wsTB.getRow(5).height = 5;

  // Column headers
  const tbHdrs = ['Project / Site', 'Source Type', 'Company / Name',
    ...TRADE_FIELDS.map(f => TRADE_LABELS[f]), 'Total'];
  tbHdrs.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    xlFill(wsTB, col, 6, {
      bg: XL.hdrBg,
      fg: i === totalCols - 1 ? XL.hdrGold : XL.hdrFg,
      val: h, bold: true, sz: 9,
      align: i > 2 ? 'center' : 'left', wrap: true,
      border: bdrBottom(XL.hdrGold),
    });
  });
  wsTB.getRow(6).height = 30;

  // Data rows
  let tbRow = 7;
  projects.forEach((proj) => {
    proj.sources.forEach((src, si) => {
      const bg        = tbRow % 2 === 0 ? XL.rowEven : XL.rowOdd;
      const bdrOpts   = bdrBottom();

      // Site name only on first source
      const siteC = wsTB.getCell(`A${tbRow}`);
      siteC.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
      siteC.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      siteC.border    = bdrOpts;
      if (si === 0) {
        siteC.value = proj.siteName;
        siteC.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + XL.textMain } };
      }

      // Source type — coloured pill-style background
      xlFill(wsTB, 'B', tbRow, { bg: srcBg(src.type), fg: srcFg(src.type), val: src.type, bold: true, sz: 9, align: 'center', border: bdrOpts });
      xlFill(wsTB, 'C', tbRow, { bg, fg: XL.textMuted, val: src.type === 'In-House' ? '—' : (src.companyName || 'Unknown'), sz: 9, border: bdrOpts });
      wsTB.getCell(`C${tbRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      TRADE_FIELDS.forEach((f, fi) => {
        const col = String.fromCharCode(68 + fi);
        const val = src.trades ? (src.trades[f] || 0) : 0;
        xlFill(wsTB, col, tbRow, { bg: val > 0 ? bg : bg, fg: val > 0 ? XL.numHi : XL.numZero, val: val > 0 ? val : '', bold: val > 0, sz: 10, align: 'center', border: bdrOpts });
      });

      const totCol = String.fromCharCode(68 + TRADE_FIELDS.length);
      xlFill(wsTB, totCol, tbRow, { bg: srcBg(src.type), fg: srcFg(src.type), val: src.total || 0, bold: true, sz: 11, align: 'center', border: bdrOpts });

      wsTB.getRow(tbRow).height = 20;
      tbRow++;
    });

    // Subtotal row
    wsTB.mergeCells(`A${tbRow}:C${tbRow}`);
    xlFill(wsTB, 'A', tbRow, { bg: XL.subtBg, fg: XL.subtFg, val: `Subtotal — ${proj.siteName}`, bold: true, sz: 9, align: 'right', border: bdrTopBottom(XL.borderDark) });
    wsTB.getCell(`A${tbRow}`).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

    TRADE_FIELDS.forEach((f, fi) => {
      const col  = String.fromCharCode(68 + fi);
      const sum  = proj.sources.reduce((s, src) => s + (src.trades ? (src.trades[f] || 0) : 0), 0);
      xlFill(wsTB, col, tbRow, { bg: XL.subtBg, fg: sum > 0 ? XL.subtFg : XL.numZero, val: sum || '', bold: sum > 0, sz: 9, align: 'center', border: bdrTopBottom(XL.borderDark) });
    });

    const totCol = String.fromCharCode(68 + TRADE_FIELDS.length);
    xlFill(wsTB, totCol, tbRow, { bg: XL.hdrBg, fg: XL.hdrGold, val: proj.grandTotal, bold: true, sz: 11, align: 'center', border: bdrTopBottom(XL.hdrGold) });

    wsTB.getRow(tbRow).height = 22;
    tbRow++;

    // blank spacer between projects
    for (let i = 0; i < totalCols; i++) {
      wsTB.getCell(`${String.fromCharCode(65 + i)}${tbRow}`).fill =
        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
    }
    wsTB.getRow(tbRow).height = 5;
    tbRow++;
  });


  // ══════════════════════════════════════════════════════════════════════
  //  SHEET 3+ — Per-Project Sheets
  // ══════════════════════════════════════════════════════════════════════
  projects.forEach((proj) => {
    const safeName = proj.siteName.replace(/[/\\?*[\]:]/g, '-').substring(0, 31);
    const wsP = wb.addWorksheet(safeName, {
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    const pTotalCols = 2 + TRADE_FIELDS.length + 1;
    const pLastCol   = String.fromCharCode(65 + pTotalCols - 1);

    wsP.columns = [
      { key: 'A', width: 22 },
      { key: 'B', width: 24 },
      ...TRADE_FIELDS.map(() => ({ width: 15 })),
      { width: 13 },
    ].map((c, i) => ({ ...c, key: String.fromCharCode(65 + i) }));

    // Banner
    wsP.mergeCells(`A1:${pLastCol}1`);
    xlFill(wsP, 'A', 1, { bg: XL.hdrBg, fg: XL.hdrGold, val: 'AGILE PRIME GENERAL CONTRACTING L.L.C.', bold: true, sz: 14, align: 'center' });
    wsP.getRow(1).height = 38;

    wsP.mergeCells(`A2:${pLastCol}2`);
    xlFill(wsP, 'A', 2, { bg: XL.hdrBg, fg: XL.hdrFg, val: proj.siteName, bold: true, sz: 12, align: 'center' });
    wsP.getRow(2).height = 26;

    wsP.mergeCells(`A3:${pLastCol}3`);
    xlFill(wsP, 'A', 3, { bg: XL.subHdrBg, fg: XL.subHdrFg, val: dateRange || 'All Dates', sz: 9, align: 'center', border: bdrBottom() });
    wsP.getRow(3).height = 18;

    wsP.mergeCells(`A4:${pLastCol}4`);
    xlFill(wsP, 'A', 4, { bg: XL.subHdrBg, fg: XL.subHdrFg, val: `Grand Total Workers: ${proj.grandTotal}`, bold: true, sz: 10, align: 'center', border: bdrBottom() });
    wsP.getRow(4).height = 20;

    // spacer
    wsP.mergeCells(`A5:${pLastCol}5`);
    wsP.getRow(5).height = 5;

    // Col headers
    const pHdrs = ['Source Type', 'Company / Name', ...TRADE_FIELDS.map(f => TRADE_LABELS[f]), 'Total'];
    pHdrs.forEach((h, i) => {
      const col = String.fromCharCode(65 + i);
      xlFill(wsP, col, 6, {
        bg: XL.hdrBg, fg: i === pTotalCols - 1 ? XL.hdrGold : XL.hdrFg,
        val: h, bold: true, sz: 9,
        align: i > 1 ? 'center' : 'left', wrap: true,
        border: bdrBottom(XL.hdrGold),
      });
    });
    wsP.getRow(6).height = 28;

    let pRow = 7;
    proj.sources.forEach((src, si) => {
      const bg      = si % 2 === 0 ? XL.rowOdd : XL.rowEven;
      const bdrOpts = bdrBottom();

      xlFill(wsP, 'A', pRow, { bg: srcBg(src.type), fg: srcFg(src.type), val: src.type, bold: true, sz: 10, border: bdrOpts });
      wsP.getCell(`A${pRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      xlFill(wsP, 'B', pRow, { bg, fg: XL.textMuted, val: src.type === 'In-House' ? '—' : (src.companyName || 'Unknown'), sz: 9, border: bdrOpts });
      wsP.getCell(`B${pRow}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      TRADE_FIELDS.forEach((f, fi) => {
        const col = String.fromCharCode(67 + fi);
        const val = src.trades ? (src.trades[f] || 0) : 0;
        xlFill(wsP, col, pRow, { bg, fg: val > 0 ? XL.numHi : XL.numZero, val: val > 0 ? val : '', bold: val > 0, sz: 10, align: 'center', border: bdrOpts });
      });

      const totCol = String.fromCharCode(67 + TRADE_FIELDS.length);
      xlFill(wsP, totCol, pRow, { bg: srcBg(src.type), fg: srcFg(src.type), val: src.total || 0, bold: true, sz: 11, align: 'center', border: bdrOpts });

      wsP.getRow(pRow).height = 22;
      pRow++;
    });

    // Totals row
    wsP.mergeCells(`A${pRow}:B${pRow}`);
    xlFill(wsP, 'A', pRow, { bg: XL.totalBg, fg: XL.hdrFg, val: 'TOTAL', bold: true, sz: 10, align: 'center', border: bdrTopBottom(XL.hdrGold) });

    TRADE_FIELDS.forEach((f, fi) => {
      const col = String.fromCharCode(67 + fi);
      const sum = proj.sources.reduce((s, src) => s + (src.trades ? (src.trades[f] || 0) : 0), 0);
      xlFill(wsP, col, pRow, { bg: XL.subtBg, fg: sum > 0 ? XL.subtFg : XL.numZero, val: sum || '', bold: sum > 0, sz: 10, align: 'center', border: bdrTopBottom(XL.hdrGold) });
    });

    const totCol = String.fromCharCode(67 + TRADE_FIELDS.length);
    xlFill(wsP, totCol, pRow, { bg: XL.hdrBg, fg: XL.hdrGold, val: proj.grandTotal, bold: true, sz: 13, align: 'center', border: bdrTopBottom(XL.hdrGold) });
    wsP.getRow(pRow).height = 28;
  });

  return wb;
}


// ═══════════════════════════════════════════════════════════════════════════
//  PDF EXPORT  (using pdfkit)
// ═══════════════════════════════════════════════════════════════════════════
async function generatePDF(data, filters = {}) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (e) {
    throw new Error('pdfkit not installed. Run: npm install pdfkit');
  }

  const { projects = [], totalReports = 0 } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      info: {
        Title:   'Manpower Breakdown Report',
        Author:  'Agile Prime — SitePulse',
        Subject: 'Trade-Level Manpower Breakdown',
        Creator: 'SitePulse v15',
      },
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end',  ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W  = doc.page.width;  // 595
    const H  = doc.page.height; // 842

    // ── Color helpers ──
    const hex2rgb = hex => {
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const bg = (r, g, b) => doc.fillColor([r, g, b]);
    const fg = (r, g, b) => doc.fillColor([r, g, b]);

    // shorthand
    const navy  = hex2rgb(C.navyDeep);
    const navyM = hex2rgb(C.navyMid);
    const navyP = hex2rgb(C.navyPanel);
    const gold  = hex2rgb(C.gold);
    const goldL = hex2rgb(C.goldLight);
    const goldD = hex2rgb(C.goldDim);
    const white = [255, 255, 255];
    const txtP  = hex2rgb(C.textPri);
    const txtS  = hex2rgb(C.textSec);
    const em    = hex2rgb(C.emerald);
    const bl    = hex2rgb(C.blue);
    const pk    = hex2rgb(C.pink);
    const yw    = hex2rgb(C.yellow);
    const bdr   = hex2rgb(C.navyBorder);

    const LM = 36; // left margin
    const RM = W - 36;
    const CW = RM - LM;

    // ── Draw full-page background ──
    function pageBg() {
      doc.rect(0, 0, W, H).fill(navy);
    }

    // ── Cover Page ──────────────────────────────────────────────────────
    pageBg();

    // Decorative gold bar left
    doc.rect(0, 0, 6, H).fill(gold);

    // Title block
    const titleY = 220;
    doc.rect(LM, titleY - 20, CW, 140).fill(navyM);
    doc.rect(LM, titleY - 20, 4, 140).fill(gold);

    doc.fontSize(22).fillColor(gold).font('Helvetica-Bold')
      .text('AGILE PRIME', LM + 20, titleY, { align: 'left' });
    doc.fontSize(11).fillColor(txtS).font('Helvetica')
      .text('GENERAL CONTRACTING L.L.C.', LM + 20, titleY + 28, { align: 'left', letterSpacing: 3 });

    doc.rect(LM + 20, titleY + 52, 200, 1).fill(gold);

    doc.fontSize(28).fillColor(white).font('Helvetica-Bold')
      .text('MANPOWER', LM + 20, titleY + 62, { align: 'left' });
    doc.fontSize(28).fillColor(gold).font('Helvetica-Bold')
      .text('BREAKDOWN', LM + 20, titleY + 93, { align: 'left' });

    // Meta
    const metaY = titleY + 180;
    const dateRange = [
      filters.fromDate ? `From: ${filters.fromDate}` : '',
      filters.toDate   ? `To: ${filters.toDate}`     : '',
    ].filter(Boolean).join('   ·   ');

    doc.fontSize(10).fillColor(txtS).font('Helvetica')
      .text('REPORT PERIOD', LM + 20, metaY, { align: 'left' });
    doc.fontSize(12).fillColor(white).font('Helvetica-Bold')
      .text(dateRange || 'All Available Dates', LM + 20, metaY + 16, { align: 'left' });

    doc.fontSize(10).fillColor(txtS).font('Helvetica')
      .text('GENERATED', LM + 300, metaY, { align: 'left' });
    doc.fontSize(12).fillColor(white).font('Helvetica-Bold')
      .text(new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }).split(',')[0], LM + 300, metaY + 16, { align: 'left' });

    doc.fontSize(10).fillColor(txtS).font('Helvetica')
      .text('TOTAL PROJECTS', LM + 20, metaY + 50, { align: 'left' });
    doc.fontSize(28).fillColor(gold).font('Helvetica-Bold')
      .text(String(projects.length), LM + 20, metaY + 66, { align: 'left' });

    doc.fontSize(10).fillColor(txtS).font('Helvetica')
      .text('REPORTS PROCESSED', LM + 120, metaY + 50, { align: 'left' });
    doc.fontSize(28).fillColor(gold).font('Helvetica-Bold')
      .text(String(totalReports), LM + 120, metaY + 66, { align: 'left' });

    const totAll = projects.reduce((s, p) => s + p.grandTotal, 0);
    doc.fontSize(10).fillColor(txtS).font('Helvetica')
      .text('TOTAL WORKERS', LM + 260, metaY + 50, { align: 'left' });
    doc.fontSize(28).fillColor(gold).font('Helvetica-Bold')
      .text(String(totAll), LM + 260, metaY + 66, { align: 'left' });

    // Footer
    doc.rect(LM, H - 60, CW, 1).fill(goldD);
    doc.fontSize(8).fillColor(goldD).font('Helvetica')
      .text('SitePulse  ·  Agile Prime General Contracting L.L.C.  ·  Confidential', LM, H - 46, { align: 'center', width: CW });

    // ── Overview Table Page ──────────────────────────────────────────────
    doc.addPage();
    pageBg();
    doc.rect(0, 0, 6, H).fill(gold);

    let y = 40;

    // Page title
    doc.fontSize(14).fillColor(gold).font('Helvetica-Bold')
      .text('PROJECT OVERVIEW', LM, y, { align: 'left' });
    y += 22;
    doc.rect(LM, y, CW, 1).fill(goldD);
    y += 10;

    // Table header
    const ovColW = [200, 70, 70, 70, 80]; // site, IH, Sup, Sub, Total
    const ovColX = [LM];
    ovColW.slice(0, -1).forEach((w, i) => ovColX.push(ovColX[i] + w));

    const drawOvRow = (vals, colors, bold, bgColor, rowH = 20) => {
      // bg
      doc.rect(LM, y, CW, rowH).fill(bgColor || navy);
      vals.forEach((v, i) => {
        const align = i === 0 ? 'left' : 'center';
        const xOff  = i === 0 ? 6 : 0;
        doc.fontSize(bold ? 9 : 9).fillColor(colors[i] || white).font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(String(v || '—'), ovColX[i] + xOff, y + (rowH - 9) / 2, { width: ovColW[i] - 4, align });
      });
      doc.rect(LM, y + rowH - 0.5, CW, 0.5).fill(bdr);
    };

    // Header row
    drawOvRow(
      ['Project / Site', 'In-House', 'Supplier', 'Subcontractor', 'Grand Total'],
      [gold, em, bl, pk, goldL],
      true, navy, 24
    );
    y += 24;

    projects.forEach((proj, pi) => {
      if (y > H - 80) {
        doc.addPage();
        pageBg();
        doc.rect(0, 0, 6, H).fill(gold);
        y = 40;
      }

      let ihT = 0, supT = 0, subT = 0;
      proj.sources.forEach(s => {
        if      (s.type === 'In-House')       ihT  += s.total;
        else if (s.type === 'Supplier')        supT += s.total;
        else                                   subT += s.total;
      });

      const rowBg = pi % 2 === 0 ? navyP : navyM;
      drawOvRow(
        [proj.siteName, ihT || '—', supT || '—', subT || '—', proj.grandTotal],
        [txtP, em, bl, pk, goldL],
        false, rowBg, 20
      );
      y += 20;
    });

    // Totals row
    const tIH  = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'In-House').reduce((a, x) => a + x.total, 0), 0);
    const tSup = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'Supplier').reduce((a, x) => a + x.total, 0), 0);
    const tSub = projects.reduce((s, p) => s + p.sources.filter(x => x.type === 'Subcontractor').reduce((a, x) => a + x.total, 0), 0);

    y += 2;
    drawOvRow(['TOTAL', tIH, tSup, tSub, tIH + tSup + tSub], [gold, em, bl, pk, goldL], true, navy, 26);
    y += 26;

    // ── Per-Project Detail Pages ─────────────────────────────────────────
    projects.forEach(proj => {
      doc.addPage();
      pageBg();
      doc.rect(0, 0, 6, H).fill(gold);

      let y = 40;

      // Project header
      doc.rect(LM, y, CW, 52).fill(navyM);
      doc.rect(LM, y, 3, 52).fill(gold);

      doc.fontSize(14).fillColor(gold).font('Helvetica-Bold')
        .text(proj.siteName, LM + 14, y + 8, { width: CW - 20 });

      const ihT  = proj.sources.filter(s => s.type === 'In-House').reduce((a, s) => a + s.total, 0);
      const supT = proj.sources.filter(s => s.type === 'Supplier').reduce((a, s) => a + s.total, 0);
      const subT = proj.sources.filter(s => s.type === 'Subcontractor').reduce((a, s) => a + s.total, 0);

      const pillsY = y + 28;
      const pills = [
        { label: `IH: ${ihT}`,   color: em  },
        { label: `Sup: ${supT}`, color: bl  },
        { label: `Sub: ${subT}`, color: pk  },
        { label: `Total: ${proj.grandTotal}`, color: goldL },
      ].filter(p => {
        const num = parseInt(p.label.split(':')[1]);
        return num > 0 || p.label.startsWith('Total');
      });

      let pillX = LM + 14;
      pills.forEach(pill => {
        const pw = doc.widthOfString(pill.label, { fontSize: 8 }) + 14;
        doc.roundedRect(pillX, pillsY, pw, 14, 3).fill(navyP);
        doc.fontSize(8).fillColor(pill.color).font('Helvetica-Bold')
          .text(pill.label, pillX + 7, pillsY + 3, { width: pw - 8, align: 'left' });
        pillX += pw + 6;
      });

      y += 62;

      // Trade table per source
      const tradeCols = TRADE_FIELDS.length;
      const srcColW   = 90;
      const coColW    = 90;
      const tradeColW = Math.floor((CW - srcColW - coColW - 40) / (tradeCols + 1));
      const totColW   = 40;

      // Build col x positions
      const trColX = [LM, LM + srcColW, LM + srcColW + coColW];
      TRADE_FIELDS.forEach((_, i) => trColX.push(trColX[2] + i * tradeColW));
      trColX.push(trColX[trColX.length - 1] + tradeColW); // total col

      const trColW = [srcColW, coColW, ...Array(tradeCols).fill(tradeColW), totColW];

      const drawTradeRow = (vals, colors, bold, bgColor, rowH = 18) => {
        doc.rect(LM, y, CW, rowH).fill(bgColor);
        vals.forEach((v, i) => {
          if (v === null) return;
          const align = i < 2 ? 'left' : 'center';
          const xOff  = i < 2 ? 5 : 0;
          doc.fontSize(bold ? 8 : 8).fillColor(colors[i] || txtP).font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .text(String(v === 0 ? '—' : (v || '—')), trColX[i] + xOff, y + (rowH - 7) / 2, {
              width: trColW[i] - 4, align, lineBreak: false,
            });
        });
        doc.rect(LM, y + rowH - 0.5, CW, 0.5).fill(bdr);
      };

      // Table header
      const trHdr = ['Type', 'Company', ...TRADE_FIELDS.map(f => TRADE_LABELS[f].split(' ').map(w => w[0]).join('')), 'Total'];
      drawTradeRow(trHdr, Array(trHdr.length).fill(gold), true, navy, 22);
      y += 22;

      proj.sources.forEach((src, si) => {
        if (y > H - 60) {
          doc.addPage();
          pageBg();
          doc.rect(0, 0, 6, H).fill(gold);
          y = 40;
        }

        const srcColor = src.type === 'In-House' ? em
          : src.type === 'Supplier'              ? bl
          : pk;

        const rowVals = [
          src.type,
          src.type === 'In-House' ? '—' : (src.companyName || 'Unknown'),
          ...TRADE_FIELDS.map(f => src.trades ? (src.trades[f] || 0) : 0),
          src.total,
        ];
        const rowColors = [srcColor, txtS, ...TRADE_FIELDS.map(() => txtP), srcColor];
        const rowBg = si % 2 === 0 ? navyP : navyM;

        drawTradeRow(rowVals, rowColors, false, rowBg, 20);
        y += 20;
      });

      // Subtotal
      const subVals = [
        'SUBTOTAL', '',
        ...TRADE_FIELDS.map(f => proj.sources.reduce((s, src) => s + (src.trades ? (src.trades[f] || 0) : 0), 0)),
        proj.grandTotal,
      ];
      const subColors = [gold, null, ...Array(tradeCols).fill(yw), goldL];

      y += 3;
      doc.rect(LM, y - 1, CW, 1).fill(gold);
      drawTradeRow(subVals, subColors, true, navy, 24);
      y += 24;

      // Footer
      doc.rect(LM, H - 32, CW, 1).fill(goldD);
      doc.fontSize(7).fillColor(goldD).font('Helvetica')
        .text('SitePulse  ·  Agile Prime General Contracting L.L.C.  ·  Confidential', LM, H - 22, { align: 'center', width: CW });
    });

    // Add page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor(goldD).font('Helvetica')
        .text(`Page ${i + 1} of ${range.count}`, 0, H - 22, { align: 'right', width: W - 20 });
    }

    doc.end();
  });
}

module.exports = { generateExcel, generatePDF };
