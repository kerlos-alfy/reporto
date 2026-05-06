/**
 * AGILE PRIME — Manpower Breakdown + Operations Panel + Alert Banner
 * Loaded after dashboard.js
 */

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════════════════════════ */
var TRADE_META = {
  steelFixer:        { label: 'Steel Fixer',    color: '#f05555', short: 'SF'  },
  steelFixerForemen: { label: 'SF Foreman',     color: '#f08055', short: 'SFF' },
  carpenter:         { label: 'Carpenter',      color: '#50b0f0', short: 'CP'  },
  carpenterForemen:  { label: 'Carpenter FM',   color: '#70c0f8', short: 'CPF' },
  helper:            { label: 'Helper',         color: '#3dd68c', short: 'HL'  },
  scaffolding:       { label: 'Scaffolding',    color: '#a78bfa', short: 'SC'  },
  engineersNo:       { label: 'Engineers',      color: '#d4a843', short: 'EN'  },
};

// Project palette — cycles if more than 6 projects
var PROJ_COLORS = ['#d4a843','#50b0f0','#3dd68c','#a78bfa','#f05555','#f0a030','#2dd4bf','#f472b6'];

function _n(v)   { return (Number(v) || 0).toLocaleString(); }
function _esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _$(s)   { return document.querySelector(s); }

/* ═══════════════════════════════════════════════════════════════════════════
   MANPOWER BREAKDOWN (Overview tab)
═══════════════════════════════════════════════════════════════════════════ */
function renderManpowerBreakdown(mb) {
  if (!mb) return;

  var bs    = mb.bySource   || {};
  var elInH = _$('#mpInHouse'), elSup = _$('#mpSupplier'), elSub = _$('#mpSubcontractor');
  if (elInH) elInH.textContent = _n(bs['In-House']      || 0);
  if (elSup) elSup.textContent = _n(bs['Supplier']      || 0);
  if (elSub) elSub.textContent = _n(bs['Subcontractor'] || 0);

  // ── Trades progress bars ──────────────────────────────────────────────────
  var tradesEl = _$('#mpTradesTable');
  if (tradesEl) {
    var bt     = mb.byTrade || {};
    var maxVal = Math.max.apply(null, Object.values(bt).map(Number).concat([1]));
    var html   = '';
    Object.keys(TRADE_META).forEach(function(key) {
      var meta = TRADE_META[key];
      var val  = Number(bt[key]) || 0;
      var pct  = Math.round((val / maxVal) * 100);
      html +=
        '<div style="margin-bottom:10px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
            '<span style="font-size:12px;color:rgba(255,255,255,0.7)">' + meta.label + '</span>' +
            '<span style="font-size:13px;font-weight:700;color:' + meta.color + '">' + _n(val) + '</span>' +
          '</div>' +
          '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:99px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:' + meta.color + ';border-radius:99px;transition:width 0.6s ease"></div>' +
          '</div>' +
        '</div>';
    });
    tradesEl.innerHTML = html;
  }

  // ── External companies ────────────────────────────────────────────────────
  var companiesEl = _$('#mpCompaniesTable');
  var noCoEl      = _$('#mpNoCompanies');
  var companies   = mb.perCompany || [];
  if (companiesEl) {
    if (companies.length === 0) {
      companiesEl.innerHTML = '';
      if (noCoEl) noCoEl.classList.remove('hidden');
    } else {
      if (noCoEl) noCoEl.classList.add('hidden');
      var maxCo  = Math.max.apply(null, companies.map(function(c){ return c.total; }).concat([1]));
      var coHtml = '';
      companies.forEach(function(c) {
        var pct        = Math.round((c.total / maxCo) * 100);
        var clr        = c.type === 'Supplier' ? '#50b0f0' : '#f0a030';
        var badgeStyle = c.type === 'Supplier'
          ? 'background:rgba(80,176,240,0.12);color:#50b0f0;border:1px solid rgba(80,176,240,0.2)'
          : 'background:rgba(240,160,48,0.12);color:#f0a030;border:1px solid rgba(240,160,48,0.2)';
        coHtml +=
          '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">' +
              '<div style="display:flex;align-items:center;gap:6px;min-width:0">' +
                '<span style="font-size:12px;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">' + _esc(c.name) + '</span>' +
                '<span style="font-size:9px;padding:1px 6px;border-radius:99px;' + badgeStyle + '">' + _esc(c.type) + '</span>' +
              '</div>' +
              '<span style="font-size:13px;font-weight:700;color:' + clr + ';margin-left:8px">' + _n(c.total) + '</span>' +
            '</div>' +
            '<div style="height:3px;background:rgba(255,255,255,0.05);border-radius:99px;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + clr + ';border-radius:99px;transition:width 0.6s ease"></div>' +
            '</div>' +
          '</div>';
      });
      companiesEl.innerHTML = coHtml;
    }
  }

  // ── Per-Project Comparison ────────────────────────────────────────────────
  _renderProjectComparison(mb.perProject || []);
}

/* ─── Per-Project Manpower Comparison ────────────────────────────────────── */
function _renderProjectComparison(projects) {
  var container = _$('#mpProjectComparison');
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML =
      '<p style="font-size:12px;color:rgba(255,255,255,0.2);text-align:center;padding:24px 0">No project data available</p>';
    return;
  }

  var maxTotal = Math.max.apply(null, projects.map(function(p){ return p.total; }).concat([1]));
  var html = '';

  projects.forEach(function(proj, idx) {
    var projColor = PROJ_COLORS[idx % PROJ_COLORS.length];
    var inHousePct = proj.total > 0 ? Math.round((proj.inHouse / proj.total) * 100) : 0;
    var supplierPct = proj.total > 0 ? Math.round((proj.supplier / proj.total) * 100) : 0;
    var subconPct = proj.total > 0 ? Math.round((proj.subcontractor / proj.total) * 100) : 0;
    var totalBarPct = Math.round((proj.total / maxTotal) * 100);

    // Company breakdown rows
    var companyRows = '';
    (proj.companies || []).forEach(function(c) {
      var clr = c.type === 'Supplier' ? '#50b0f0' : '#f0a030';
      var cPct = proj.total > 0 ? Math.round((c.total / proj.total) * 100) : 0;
      companyRows +=
        '<div style="display:flex;align-items:center;gap:8px;margin-top:5px">' +
          '<div style="width:6px;height:6px;border-radius:50%;background:' + clr + ';flex-shrink:0"></div>' +
          '<span style="font-size:11px;color:rgba(255,255,255,0.55);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(c.name) + '</span>' +
          '<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:' + (c.type === 'Supplier' ? 'rgba(80,176,240,0.1)' : 'rgba(240,160,48,0.1)') + ';color:' + clr + ';flex-shrink:0">' + _esc(c.type) + '</span>' +
          '<span style="font-size:12px;font-weight:700;color:' + clr + ';flex-shrink:0;min-width:32px;text-align:right">' + _n(c.total) + '</span>' +
          '<span style="font-size:10px;color:rgba(255,255,255,0.25);flex-shrink:0;min-width:28px;text-align:right">' + cPct + '%</span>' +
        '</div>';
    });
    if (!companyRows) {
      companyRows = '<p style="font-size:11px;color:rgba(255,255,255,0.2);margin-top:6px">No external labor</p>';
    }

    // Stacked bar: In-House | Supplier | Sub-Con
    var stackedBar = '';
    if (inHousePct > 0) stackedBar += '<div style="height:100%;width:' + inHousePct + '%;background:#3dd68c;transition:width 0.6s ease" title="In-House: ' + _n(proj.inHouse) + '"></div>';
    if (supplierPct > 0) stackedBar += '<div style="height:100%;width:' + supplierPct + '%;background:#50b0f0;transition:width 0.6s ease" title="Supplier: ' + _n(proj.supplier) + '"></div>';
    if (subconPct > 0)   stackedBar += '<div style="height:100%;width:' + subconPct + '%;background:#f0a030;transition:width 0.6s ease" title="Sub-Con: ' + _n(proj.subcontractor) + '"></div>';

    html +=
      '<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;margin-bottom:10px">' +

        // Header: project name + total
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<div style="width:10px;height:10px;border-radius:3px;background:' + projColor + ';flex-shrink:0"></div>' +
            '<span style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.9)">' + _esc(proj.siteName) + '</span>' +
          '</div>' +
          '<span style="font-size:20px;font-weight:800;color:' + projColor + '">' + _n(proj.total) + '</span>' +
        '</div>' +

        // Total bar (relative to max project)
        '<div style="height:5px;background:rgba(255,255,255,0.05);border-radius:99px;overflow:hidden;margin-bottom:10px">' +
          '<div style="height:100%;width:' + totalBarPct + '%;background:' + projColor + ';border-radius:99px;transition:width 0.6s ease"></div>' +
        '</div>' +

        // Source split pills
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          _projPill('In-House', proj.inHouse, inHousePct, '#3dd68c') +
          _projPill('Supplier', proj.supplier, supplierPct, '#50b0f0') +
          _projPill('Sub-Con',  proj.subcontractor, subconPct, '#f0a030') +
        '</div>' +

        // Stacked bar (source mix)
        '<div style="height:6px;background:rgba(255,255,255,0.04);border-radius:99px;overflow:hidden;display:flex;margin-bottom:12px">' +
          stackedBar +
        '</div>' +

        // Company breakdown
        '<div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:10px">' +
          '<p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.25);margin-bottom:4px">External Companies</p>' +
          companyRows +
        '</div>' +

      '</div>';
  });

  container.innerHTML = html;
}

function _projPill(label, val, pct, color) {
  if (val <= 0) return '';
  return '<div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:4px 8px">' +
    '<div style="width:6px;height:6px;border-radius:50%;background:' + color + ';flex-shrink:0"></div>' +
    '<span style="font-size:10px;color:rgba(255,255,255,0.45)">' + label + '</span>' +
    '<span style="font-size:11px;font-weight:700;color:' + color + '">' + _n(val) + '</span>' +
    '<span style="font-size:10px;color:rgba(255,255,255,0.25)">' + pct + '%</span>' +
  '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPERATIONS PANEL — Workforce Detail
═══════════════════════════════════════════════════════════════════════════ */
var _opsData      = null;
var _opsActivePrj = null;   // null = "All"

function renderOperationsPanel(panel) {
  if (!panel) {
    console.warn('[Ops] panel is null/undefined');
    return;
  }
  _opsData = panel;
  _opsActivePrj = null; // reset on every data refresh

  console.log('[Ops] projects:', (panel.projects || []).length, 'totals:', (panel.totals||{}).totalWorkers);

  // Grand total badge
  var totEl = _$('#opsTotalNum');
  if (totEl) totEl.textContent = _n((panel.totals || {}).totalWorkers);

  _buildProjPills(panel.projects || []);
  _renderOpsActivities(_opsActivePrj);
}

function _buildProjPills(projects) {
  var wrap = _$('#opsProjPills');
  if (!wrap) return;

  // Grand total across all projects
  var grand = (projects || []).reduce(function(s,p){ return s + (p.totalWorkers||0); }, 0);

  var html = '<button class="ops-proj-pill active" data-proj="">' +
    'All Projects <span class="pill-count">' + _n(grand) + '</span></button>';

  projects.forEach(function(p, idx) {
    var color = PROJ_COLORS[idx % PROJ_COLORS.length];
    html += '<button class="ops-proj-pill" data-proj="' + _esc(p.name) + '" style="--pc:' + color + '">' +
      _esc(p.name) + ' <span class="pill-count">' + _n(p.totalWorkers) + '</span></button>';
  });

  wrap.innerHTML = html;

  wrap.querySelectorAll('.ops-proj-pill').forEach(function(btn) {
    btn.addEventListener('click', function() {
      wrap.querySelectorAll('.ops-proj-pill').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      _opsActivePrj = btn.dataset.proj || null;
      _renderOpsActivities(_opsActivePrj);
    });
  });
}

function _renderOpsActivities(projFilter) {
  var container = _$('#opsActivitiesContainer');
  var emptyEl   = _$('#opsEmpty');
  if (!container || !_opsData) return;

  var projects = _opsData.projects || [];
  if (projFilter) {
    projects = projects.filter(function(p){ return p.name === projFilter; });
  }

  // Flatten all activities across selected projects
  var allActs = [];
  projects.forEach(function(p) {
    (p.activities || []).forEach(function(a) {
      allActs.push({ proj: p.name, act: a });
    });
  });

  if (!allActs.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  // Sort by totalWorkers desc
  allActs.sort(function(a,b){ return b.act.totalWorkers - a.act.totalWorkers; });

  var html = '';
  allActs.forEach(function(item, idx) {
    var a   = item.act;
    var prog = Number(a.avgProgress) || 0;
    var progCls = prog >= 80 ? 'prog-ok' : prog >= 45 ? 'prog-warn' : 'prog-bad';

    // Source chips
    var srcHtml = '';
    if (a.inHouse > 0)       srcHtml += '<span class="ops-src-chip" style="background:rgba(61,214,140,0.08);border:1px solid rgba(61,214,140,0.2)"><span class="dot" style="background:#3dd68c"></span><span style="color:#3dd68c">' + _n(a.inHouse) + '</span><span style="color:rgba(255,255,255,0.25);font-size:10px">In-House</span></span>';
    if (a.supplier > 0)      srcHtml += '<span class="ops-src-chip" style="background:rgba(80,176,240,0.08);border:1px solid rgba(80,176,240,0.2)"><span class="dot" style="background:#50b0f0"></span><span style="color:#50b0f0">' + _n(a.supplier) + '</span><span style="color:rgba(255,255,255,0.25);font-size:10px">Supplier</span></span>';
    if (a.subcontractor > 0) srcHtml += '<span class="ops-src-chip" style="background:rgba(240,160,48,0.08);border:1px solid rgba(240,160,48,0.2)"><span class="dot" style="background:#f0a030"></span><span style="color:#f0a030">' + _n(a.subcontractor) + '</span><span style="color:rgba(255,255,255,0.25);font-size:10px">Sub-Con</span></span>';

    // Trade grid
    var tradeHtml = '';
    var bt = a.byTrade || {};
    Object.keys(TRADE_META).forEach(function(key) {
      var meta = TRADE_META[key];
      var val  = Number(bt[key]) || 0;
      if (!val) return;
      tradeHtml +=
        '<div class="ops-trade-cell">' +
          '<span class="ops-trade-num" style="color:' + meta.color + '">' + _n(val) + '</span>' +
          '<span class="ops-trade-lbl">' + meta.label + '</span>' +
        '</div>';
    });
    if (!tradeHtml) tradeHtml = '<span style="font-size:12px;color:rgba(255,255,255,0.2)">No trade data</span>';

    // Company chips
    var compHtml = '';
    (a.companies || []).forEach(function(c) {
      if (!c.count) return;
      compHtml += '<span class="ops-company-chip">' + _esc(c.name) + ' <b>' + _n(c.count) + '</b></span> ';
    });

    // Date range
    var dateRange = '';
    if (a.dateMin && a.dateMax) {
      var d1 = new Date(a.dateMin).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
      var d2 = new Date(a.dateMax).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
      dateRange = d1 === d2 ? d1 : d1 + ' — ' + d2;
    }

    var cardId = 'ops-card-' + idx;
    html +=
      '<div class="ops-act-card" id="' + cardId + '">' +
        // ── header (clickable) ──
        '<div class="ops-act-header" onclick="toggleOpsCard(\'' + cardId + '\')">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="ops-act-name">' + _esc(a.activity) + '</div>' +
            '<div class="ops-act-meta">' +
              (a.element ? '<span class="ops-meta-tag element">' + _esc(a.element) + '</span>' : '') +
              (a.level   ? '<span class="ops-meta-tag level">'   + _esc(a.level)   + '</span>' : '') +
              (dateRange ? '<span class="ops-meta-tag">' + dateRange + '</span>' : '') +
              (prog > 0  ? '<span class="ops-meta-tag ' + progCls + '">' + prog + '% progress</span>' : '') +
              (!projFilter ? '<span class="ops-meta-tag" style="background:rgba(201,168,76,0.08);color:rgba(201,168,76,0.6)">' + _esc(item.proj) + '</span>' : '') +
            '</div>' +
            '<div class="ops-src-strip">' + srcHtml + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div class="ops-act-total">' +
              '<span class="ops-act-total-num">' + _n(a.totalWorkers) + '</span>' +
              '<span class="ops-act-total-lbl">workers</span>' +
            '</div>' +
            '<svg class="ops-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
          '</div>' +
        '</div>' +
        // ── body (collapsed by default) ──
        '<div class="ops-act-body">' +
          '<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.2);margin-bottom:10px">Trade Breakdown</p>' +
          '<div class="ops-trade-grid">' + tradeHtml + '</div>' +
          (compHtml ? '<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.2);margin:14px 0 8px">External Companies</p><div style="display:flex;flex-wrap:wrap;gap:6px">' + compHtml + '</div>' : '') +
        '</div>' +
      '</div>';
  });

  container.innerHTML = html;
}

window.toggleOpsCard = function(id) {
  var card = document.getElementById(id);
  if (card) card.classList.toggle('open');
};

/* ═══════════════════════════════════════════════════════════════════════════
   ALERT BANNER
═══════════════════════════════════════════════════════════════════════════ */
function loadAlert() {
  fetch('/api/admin/alert')
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.success && data.alert) showAlertBanner(data.alert);
    })
    .catch(function(){});
}

function showAlertBanner(alert) {
  var banner = _$('#alertBanner');
  if (!banner) return;

  var dateStr = alert.date
    ? new Date(alert.date).toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long' })
    : 'Yesterday';

  var subtitle = _$('#alertSubtitle');
  if (subtitle) subtitle.textContent = alert.totalMissing + ' of ' + alert.totalEngineers + ' engineers did not submit a report for ' + dateStr;

  var engContainer = _$('#alertEngineers');
  if (engContainer) {
    engContainer.innerHTML = (alert.missingEngineers || []).map(function(name) {
      return '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;background:rgba(245,158,11,0.12);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">' + _esc(name) + '</span>';
    }).join('');
  }

  banner.classList.remove('hidden');
}

function dismissAlert() {
  fetch('/api/admin/alert/dismiss', { method: 'POST' })
    .then(function(){
      var banner = _$('#alertBanner');
      if (banner) banner.classList.add('hidden');
    })
    .catch(function(){});
}

function triggerManualCheck() {
  var btn = document.querySelector('#alertBanner .check-now-btn');
  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }
  fetch('/api/admin/alert/check', { method: 'POST' })
    .then(function(){ return loadAlert(); })
    .catch(function(){})
    .finally(function(){
      if (btn) { btn.textContent = 'Check Now'; btn.disabled = false; }
    });
}

document.addEventListener('DOMContentLoaded', function() {
  loadAlert();
});
