/**
 * Reporto— Dashboard Controller v2
 * Tab navigation · Mobile filter sheet · Fixed export route
 */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // 12h time formatter — input: "HH:MM" (24h stored), output: "H:MM AM/PM"
  function fmt12(t) {
    if (!t) return '';
    const h = parseInt(t, 10), m = t.split(':')[1] || '00';
    return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  let charts = {};
  let currentTableRows = [];
  let cachedChartData = null;
  let activeTab = 'overview';

  const PAL = ['#d4a843','#50b0f0','#3dd68c','#a78bfa','#f05555','#f0a030','#2dd4bf','#f472b6','#818cf8','#4ade80'];

  /* ─── Helpers ─── */
  function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function n(v) { return (Number(v)||0).toLocaleString(); }
  function pct(v) { return `${Number(v)||0}%`; }
  function d(v) { if(!v) return '—'; const x=new Date(v); return isNaN(x)?esc(v):x.toLocaleDateString('en-GB',{year:'numeric',month:'short',day:'2-digit'}); }

  function tone(p) {
    p = Number(p)||0;
    if (p>=80) return {l:'On Track', c:'bg-emerald-500/15 text-emerald-300', dot:'bg-emerald-400', bar:'bg-emerald-400'};
    if (p>=45) return {l:'In Progress', c:'bg-amber-500/15 text-amber-300', dot:'bg-amber-400', bar:'bg-amber-400'};
    return {l:'Attention', c:'bg-rose-500/15 text-rose-300', dot:'bg-rose-400', bar:'bg-rose-400'};
  }

  function killCharts() { Object.values(charts).forEach(c => c?.destroy?.()); charts = {}; }

  /* ─── Tab system ─── */
  function switchTab(name) {
    activeTab = name;
    $$('.view').forEach(v => v.classList.remove('is-active'));
    $(`#v-${name}`)?.classList.add('is-active');
    $$('.bnav-btn').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.dtab').forEach(b => { b.classList.toggle('on', b.dataset.tab === name); });
    if (name === 'charts' && cachedChartData) {
      renderChartsTab(cachedChartData);
      if (typeof renderLaborAnalytics === 'function' && window._lastDashData) {
        renderLaborAnalytics(window._lastDashData.manpowerBreakdown || {}, window._lastDashData.groupedReports || []);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.bnav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('.dtab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  /* ─── Filter sheet (mobile) ─── */
  const sheetBg = $('#sheetBg'), sheet = $('#sheet');

  function openSheet() { sheetBg?.classList.add('on'); sheet?.classList.add('on'); document.body.style.overflow='hidden'; syncF('d2m'); }
  function closeSheet() { sheetBg?.classList.remove('on'); sheet?.classList.remove('on'); document.body.style.overflow=''; }

  $('#mFilterOpen')?.addEventListener('click', openSheet);
  $('#sheetClose')?.addEventListener('click', closeSheet);
  sheetBg?.addEventListener('click', closeSheet);

  const fMap = [
    ['fFromDate','mFromDate'],['fToDate','mToDate'],['fProject','mProject'],['fEngineer','mEngineer'],
    ['fActivity','mActivity'],['fLevel','mLevel'],['fSourceType','mSourceType'],['fSearch','mSearch']
  ];

  function syncF(dir) {
    fMap.forEach(([dk,mk]) => {
      const de=$(`#${dk}`), me=$(`#${mk}`);
      if(!de||!me) return;
      if(dir==='d2m') me.value=de.value; else de.value=me.value;
    });
  }

  $('#mApply')?.addEventListener('click', () => { syncF('m2d'); closeSheet(); loadDashboard(); });
  $('#mClear')?.addEventListener('click', () => { fMap.forEach(([,mk])=>{const e=$(`#${mk}`);if(e)e.value='';}); syncF('m2d'); closeSheet(); loadDashboard(); });

  /* ─── Load dashboard ─── */
  async function loadDashboard() {
    const params = new URLSearchParams();
    const ids = ['fFromDate','fToDate','fProject','fEngineer','fActivity','fLevel','fSourceType','fSearch'];
    const keys = ['fromDate','toDate','project','engineer','activity','level','sourceType','search'];
    ids.forEach((id,i) => { const v=$(`#${id}`)?.value; if(v) params.set(keys[i],v); });

    $('#dashLoading').classList.remove('hidden');
    $('#dashContent').classList.add('hidden');

    try {
      const res = await fetch(`/api/admin/dashboard?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');

      // Show limit warning if data was truncated
      const limitBanner = document.getElementById('limitBanner');
      if (limitBanner) {
        if (data.limitApplied) {
          limitBanner.textContent = `⚠️ Showing latest 500 of ${data.totalCount.toLocaleString()} reports. Narrow your filters for complete results.`;
          limitBanner.classList.remove('hidden');
        } else {
          limitBanner.classList.add('hidden');
        }
      }

      renderKPIs(data.summary || {});

      cachedChartData = data.charts || {};
      renderOverviewCharts(cachedChartData);
      if (activeTab === 'charts') renderChartsTab(cachedChartData);

      renderGroupedReports(data.groupedReports || []);
      currentTableRows = data.tableRows || [];
      renderTable(currentTableRows);
      if (typeof renderManpowerBreakdown === "function") renderManpowerBreakdown(data.manpowerBreakdown || null);
      renderManpowerKPI(data.manpowerBreakdown || null);
      if (typeof renderOperationsPanel === "function") renderOperationsPanel(data.operationsPanel || null);
      if (typeof renderLaborAnalytics === "function" && activeTab === 'charts') {
        renderLaborAnalytics(data.manpowerBreakdown || {}, data.groupedReports || []);
      }
      // Store for tab switch
      window._lastDashData = data;

      $('#dashLoading').classList.add('hidden');
      $('#dashContent').classList.remove('hidden');
    } catch (err) {
      $('#dashLoading').innerHTML = '<div class="text-center py-16"><p class="text-rose-400 text-sm font-semibold">Failed to load</p><button onclick="location.reload()" class="text-xs text-white/30 mt-3 underline">Retry</button></div>';
    }
  }

  /* ─── KPIs ─── */
  function renderKPIs(s) {
    $('#kpiReports').textContent    = n(s.totalReports);
    $('#kpiActivities').textContent = n(s.totalActivities);
    $('#kpiProjects').textContent   = n(s.activeProjects);
    $('#kpiManpower').textContent   = n(s.totalManpower); // refined by renderManpowerKPI after breakdown loads
  }

  function renderManpowerKPI(mb) {
    if (!mb || !mb.bySource) return;
    const bs = mb.bySource;
    const total = (bs['In-House'] || 0) + (bs['Supplier'] || 0) + (bs['Subcontractor'] || 0);
    $('#kpiManpower').textContent = n(total);
  }



  /* ─── Charts ─── */
  function cOpts() {
    return {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{display:false},
        tooltip:{backgroundColor:'#151c28',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,titleColor:'#fff',bodyColor:'#bbb',displayColors:false,padding:12,cornerRadius:10,titleFont:{size:12,weight:600},bodyFont:{size:12}}
      },
      scales: {
        x:{ticks:{color:'#555',maxRotation:0,font:{size:10,weight:500}},grid:{color:'rgba(255,255,255,0.025)'},border:{display:false}},
        y:{ticks:{color:'#555',font:{size:10,weight:500}},grid:{color:'rgba(255,255,255,0.025)'},border:{display:false}}
      }
    };
  }

  function barChart(ctx, labels, values, colorFn) {
    return new Chart(ctx, {
      type:'bar',
      data: { labels, datasets: [{ data:values, backgroundColor:labels.map((_,i)=>(colorFn?colorFn(i):PAL[i%PAL.length])+'cc'), borderRadius:10, maxBarThickness:40 }] },
      options: cOpts()
    });
  }

  function buildComboChart(ctx, labels, mpValues, pctValues) {
    const o = cOpts();
    // Two y-axes
    const opts = {
      ...o,
      plugins: {
        ...o.plugins,
        legend: { display: false },
        tooltip: {
          ...o.plugins.tooltip,
          displayColors: true,
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex === 0) return ' Manpower: ' + ctx.parsed.y;
              return ' Progress: ' + ctx.parsed.y + '%';
            }
          }
        }
      },
      scales: {
        x: o.scales.x,
        y: {
          ...o.scales.y,
          position: 'left',
          title: { display: true, text: 'Workers', color: '#444', font: { size: 10 } }
        },
        y2: {
          ...o.scales.y,
          position: 'right',
          min: 0, max: 100,
          grid: { display: false },
          title: { display: true, text: 'Progress %', color: '#444', font: { size: 10 } },
          ticks: { ...o.scales.y.ticks, callback: v => v + '%' }
        }
      }
    };
    return new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Manpower',
            data: mpValues,
            backgroundColor: labels.map((_,i) => PAL[(i+2)%PAL.length] + 'cc'),
            borderRadius: 10,
            maxBarThickness: 48,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Progress %',
            data: pctValues,
            borderColor: '#50b0f0',
            backgroundColor: 'rgba(80,176,240,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#50b0f0',
            pointBorderColor: '#10151f',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: true,
            yAxisID: 'y2'
          }
        ]
      },
      options: opts
    });
  }

  function renderOverviewCharts(c) {
    ['ov1'].forEach(k => { if(charts[k]) charts[k].destroy(); });
    const el = document.getElementById('chartCombo1');
    if (!el) return;

    const mpMap = {};
    (c.projectManpower?.labels || []).forEach((l,i) => mpMap[l] = c.projectManpower.values[i]);
    const labels = c.projectManpower?.labels || [];
    const mp     = labels.map(l => mpMap[l] || 0);

    const o = cOpts();
    charts.ov1 = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data: mp, backgroundColor: labels.map((_,i) => PAL[(i+2)%PAL.length]+'cc'), borderRadius: 10, maxBarThickness: 48 }] },
      options: { ...o, plugins: { ...o.plugins, tooltip: { ...o.plugins.tooltip, callbacks: { label: ctx => ' Manpower: ' + ctx.parsed.y } } } }
    });
  }

  function renderChartsTab(c) {
    ['t3','t4'].forEach(k => { if(charts[k]) { charts[k].destroy(); delete charts[k]; }});

    const e=$('#chartEngineer'), s=$('#chartSource');

    if(e) {
      const o = cOpts();
      charts.t3 = new Chart(e, {
        type:'bar',
        data: { labels:c.engineerActivities?.labels||[], datasets:[{data:c.engineerActivities?.values||[],backgroundColor:'#50b0f0cc',borderRadius:10,maxBarThickness:24}]},
        options:{...o,indexAxis:'y',scales:{x:o.scales.x,y:{...o.scales.y,grid:{display:false}}}}
      });
    }

    if(s) {
      charts.t4 = new Chart(s, {
        type:'doughnut',
        data:{labels:c.sourceDistribution?.labels||[],datasets:[{data:c.sourceDistribution?.values||[],backgroundColor:['#d4a843','#50b0f0','#f05555','#3dd68c','#a78bfa','#f0a030'],borderWidth:0}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#777',padding:16,font:{size:12,weight:500},usePointStyle:true,pointStyleWidth:8}},tooltip:{backgroundColor:'#151c28',borderColor:'rgba(255,255,255,0.08)',borderWidth:1,titleColor:'#fff',bodyColor:'#bbb',padding:12,cornerRadius:10}}}
      });
    }
  }

  /* ─── Labor Analytics Charts ─── */
  let laborCharts = {};

  function renderLaborAnalytics(mb, reports) {
    // ── Trade Mix — enhanced horizontal bar chart (DEFAULT) ──
    function renderTrades() {
      if (laborCharts.trades) { laborCharts.trades.destroy(); delete laborCharts.trades; }
      const el = document.getElementById('chartTrades');
      if (!el) return;
      const bt = mb.byTrade || {};
      const tradeLabels = ['Steel Fixer', 'SF Foremen', 'Carpenter', 'Carp FM', 'Helper', 'Scaffolding', 'Engineers'];
      const tradeKeys   = ['steelFixer', 'steelFixerForemen', 'carpenter', 'carpenterForemen', 'helper', 'scaffolding', 'engineersNo'];
      const tradeColors = ['#f05555','#f08055','#50b0f0','#70c0f8','#3dd68c','#a78bfa','#d4a843'];
      // Filter out zero-value trades for a cleaner chart
      const filtered = tradeLabels.map((l,i) => ({ l, v: tradeKeys[i] in bt ? (bt[tradeKeys[i]]||0) : 0, c: tradeColors[i] })).filter(x => x.v > 0);
      const o = cOpts();
      laborCharts.trades = new Chart(el, {
        type: 'bar',
        data: {
          labels: filtered.map(x => x.l),
          datasets: [{
            data: filtered.map(x => x.v),
            backgroundColor: filtered.map(x => x.c + 'cc'),
            borderRadius: 10,
            maxBarThickness: 36,
          }]
        },
        options: {
          ...o,
          indexAxis: 'y',
          plugins: {
            ...o.plugins,
            legend: { display: false },
            tooltip: { ...o.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.x} workers` } }
          },
          scales: {
            x: { ...o.scales.x, title: { display: true, text: 'Workers', color: '#444', font: { size: 10 } } },
            y: { ...o.scales.y, grid: { display: false } }
          }
        }
      });
    }

    // ── By Project stacked bar ──
    function renderProjectSources() {
      if (laborCharts.projSrc) { laborCharts.projSrc.destroy(); delete laborCharts.projSrc; }
      const el = document.getElementById('chartProjectSources');
      if (!el) return;
      const projects = (mb.perProject || []).slice(0, 8);
      if (!projects.length) return;
      const labels = projects.map(p => p.siteName.length > 16 ? p.siteName.slice(0,14)+'…' : p.siteName);
      const o = cOpts();
      laborCharts.projSrc = new Chart(el, {
        type: 'bar',
        data: { labels, datasets: [
          { label: 'In-House',      data: projects.map(p => p.inHouse),      backgroundColor: '#c9a84ccc', borderRadius: 0, stack: 'mp', maxBarThickness: 50 },
          { label: 'Supplier',      data: projects.map(p => p.supplier),      backgroundColor: '#60a5facc', borderRadius: 0, stack: 'mp', maxBarThickness: 50 },
          { label: 'Subcontractor', data: projects.map(p => p.subcontractor), backgroundColor: '#a78bfacc', borderRadius: 4, stack: 'mp', maxBarThickness: 50 },
        ]},
        options: { ...o,
          plugins: { ...o.plugins, legend: { display: true, position: 'bottom',
            labels: { color: '#888', font: { size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 }
          }},
          scales: { x: o.scales.x, y: { ...o.scales.y, stacked: true, title: { display: true, text: 'Workers', color: '#444', font: { size: 10 } } } }
        }
      });
    }

    // ── Daily Trend line (last 14 days) ──
    function renderTrend() {
      if (laborCharts.trend) { laborCharts.trend.destroy(); delete laborCharts.trend; }
      const el = document.getElementById('chartLaborTrend');
      if (!el || !reports) return;
      const dayMap = {};
      (reports || []).forEach(r => {
        const dk = (r.date || '').toString().slice(0, 10);
        if (!dayMap[dk]) dayMap[dk] = { ih: 0, sup: 0, sub: 0 };
        (r.items || []).forEach(i => {
          (i.sources || []).forEach(s => {
            const tot = Number(s.totalManpower) || 0;
            if (s.type === 'In-House') dayMap[dk].ih += tot;
            else if (s.type === 'Supplier') dayMap[dk].sup += tot;
            else if (s.type === 'Subcontractor') dayMap[dk].sub += tot;
          });
        });
      });
      const sortedDays = Object.keys(dayMap).sort().slice(-14);
      const labels = sortedDays.map(dk => {
        const dt = new Date(dk + 'T00:00:00');
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      });
      const o = cOpts();
      laborCharts.trend = new Chart(el, {
        type: 'line',
        data: { labels, datasets: [
          { label: 'In-House',      data: sortedDays.map(d => dayMap[d].ih),  borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,0.08)',  borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#c9a84c' },
          { label: 'Supplier',      data: sortedDays.map(d => dayMap[d].sup), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.08)',   borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#60a5fa' },
          { label: 'Subcontractor', data: sortedDays.map(d => dayMap[d].sub), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#a78bfa' },
        ]},
        options: { ...o, plugins: { ...o.plugins, legend: { display: true, position: 'bottom',
          labels: { color: '#888', font: { size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 }
        }}}
      });
    }

    // Render active tab
    function renderActiveTab() {
      const active = document.querySelector('.labor-tab-btn.active');
      const tab = active?.dataset.ltab || 'trades';
      if (tab === 'trades')    renderTrades();
      else if (tab === 'projects') renderProjectSources();
      else if (tab === 'trend')    renderTrend();
    }

    // Tab switching
    document.querySelectorAll('.labor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.labor-tab-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = '#64748b';
          b.classList.remove('active');
        });
        btn.style.background = 'rgba(201,168,76,0.15)';
        btn.style.color = '#c9a84c';
        btn.classList.add('active');
        document.querySelectorAll('.labor-tab-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('ltab-' + btn.dataset.ltab);
        if (panel) panel.style.display = '';
        renderActiveTab();
      });
    });

    // Initial render — Trade Mix as default
    renderTrades();

    // Store refs for tab re-renders
    window._laborMb      = mb;
    window._laborReports = reports;
  }

    /* ─── Timeline button helper ─── */
  window.updateTimelineBtn = function(sel) {
    const btn = document.getElementById('timelineBtn');
    if (!btn) return;
    const projId = window.PROJECT_ID_MAP?.[sel.options[sel.selectedIndex]?.dataset?.name];
    if (sel.value && projId) {
      btn.href = `/admin/projects/${projId}/timeline`;
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  };

  /* ─── Grouped reports ─── */
  function renderGroupedReports(groups) {
    const box = $('#groupedReportsContainer');
    const badge = $('#reportsCountBadge');
    if(badge) badge.textContent = `${n(groups.length)} reports`;

    if(!groups.length) {
      box.innerHTML = `<div class="rpt-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p>No reports match your filters</p>
      </div>`;
      return;
    }

    // Group by date
    const byDate = {};
    groups.forEach(g => {
      const dk = d(g.date);
      if(!byDate[dk]) byDate[dk] = [];
      byDate[dk].push(g);
    });

    box.innerHTML = Object.entries(byDate).map(([dateStr, dateGroups]) => {
      const totalMP    = dateGroups.reduce((s,g) => s+(Number(g.totalManpower)||0), 0);
      const totalItems = dateGroups.reduce((s,g) => s+(Number(g.itemsCount)||0), 0);

      return `
      <div class="rpt-date-group">
        <div class="rpt-date-header">
          <div class="rpt-date-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>${dateStr}</span>
          </div>
          <div class="rpt-date-stats">
            <span>${dateGroups.length} reports</span>
            <span class="rpt-date-dot"></span>
            <span>${n(totalItems)} activities</span>
            <span class="rpt-date-dot"></span>
            <span>${n(totalMP)} workers</span>
          </div>
        </div>

        <div class="rpt-cards-grid">
          ${dateGroups.map(g => {
            const items      = g.items || [];
            const globalIdx  = groups.indexOf(g);
            const hasDelays  = !!g.generalDelays;
            const hasComment = !!g.generalComment;
            const pct        = Math.min(Math.max(Number(g.averageProgress)||0, 0), 100);
            const pColor     = pct>=80 ? 'ok' : pct>=45 ? 'warn' : 'bad';
            const statusLbl  = hasDelays ? 'Delayed' : (pct>=80 ? 'On Track' : pct>=45 ? 'In Progress' : 'In Progress');
            const statusCls  = hasDelays ? 'bad' : (pct>=80 ? 'ok' : 'warn');

            // Mini breakdown
            const doneN = items.filter(i=>(Number(i.progress)||0)>=80).length;
            const warnN = items.filter(i=>{const p=Number(i.progress)||0;return p>=45&&p<80;}).length;
            const lowN  = items.filter(i=>(Number(i.progress)||0)<45).length;

            // Progress bar segments width %
            const tot = items.length || 1;

            return `
            <div class="nc-card ${hasDelays?'nc-card--delayed':''}" style="cursor:pointer;" onclick="window.location.href='/admin/reports/${esc(g.reportId)}'">

              <!-- ① top row: ID + status -->
              <div class="nc-top">
                <span class="nc-id">${esc(g.reportId||'—')}</span>
                <span class="nc-badge nc-badge--${statusCls}">${statusLbl}</span>
              </div>

              <!-- ② project name — biggest, most important -->
              <div class="nc-project" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                <span>${esc(g.siteName||'—')}</span>
                ${window.PROJECT_ID_MAP?.[g.siteName] ? `<a href="/admin/projects/${window.PROJECT_ID_MAP[g.siteName]}/timeline" onclick="event.stopPropagation()" title="View Timeline" style="flex-shrink:0;display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;color:rgba(201,168,76,0.55);text-decoration:none;letter-spacing:.05em;padding:2px 6px;border-radius:4px;border:1px solid rgba(201,168,76,0.15);transition:all .15s" onmouseover="this.style.color='#c9a84c';this.style.borderColor='rgba(201,168,76,0.4)'" onmouseout="this.style.color='rgba(201,168,76,0.55)';this.style.borderColor='rgba(201,168,76,0.15)'"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>TIMELINE</a>` : ''}
              </div>

              <!-- ③ engineer -->
              <div class="nc-eng">
                <span class="nc-eng-av">${(g.engineerName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>
                <span class="nc-eng-name">${esc(g.engineerName||'—')}</span>
              </div>

              <!-- ③b shift + time — only if data exists -->
              ${(g.shiftType || g.startTime) ? `
              <div class="nc-shift-row">
                ${g.shiftType ? `<span class="nc-shift-badge nc-shift-badge--${(g.shiftType||'').toLowerCase()}">
                  ${g.shiftType==='Night'
                    ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
                    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'}
                  ${esc(g.shiftType)} Shift
                </span>` : ''}
                ${(g.startTime && g.endTime) ? `
                  <span class="nc-shift-sep"></span>
                  <span class="nc-shift-time">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    ${esc(fmt12(g.startTime))} – ${esc(fmt12(g.endTime))}
                  </span>
                  ${g.shiftDurationMinutes ? `<span class="nc-shift-dur">&nbsp;· ${Math.floor(g.shiftDurationMinutes/60)}h${g.shiftDurationMinutes%60?' '+g.shiftDurationMinutes%60+'m':''}</span>` : ''}
                ` : ''}
              </div>` : ''}

              <!-- ④ divider -->
              <div class="nc-divider"></div>

              <!-- ⑤ three stats in one clean row -->
              <div class="nc-stats">
                <div class="nc-stat">
                  <span class="nc-stat-n">${Math.round(pct)}%</span>
                  <span class="nc-stat-l">Avg Progress</span>
                </div>
                <div class="nc-stat-sep"></div>
                <div class="nc-stat">
                  <span class="nc-stat-n">${n(g.itemsCount)}</span>
                  <span class="nc-stat-l">Activities</span>
                </div>
                <div class="nc-stat-sep"></div>
                <div class="nc-stat">
                  <span class="nc-stat-n">${n(g.totalManpower)}</span>
                  <span class="nc-stat-l">Workers</span>
                </div>
              </div>

              <!-- ⑥ activity mini bar (only if items exist) -->
              ${items.length ? `
              <div class="nc-minibar-wrap">
                <div class="nc-minibar">
                  ${doneN ? `<div class="nc-seg nc-seg--ok" style="flex:${doneN}"></div>` : ''}
                  ${warnN ? `<div class="nc-seg nc-seg--warn" style="flex:${warnN}"></div>` : ''}
                  ${lowN  ? `<div class="nc-seg nc-seg--bad"  style="flex:${lowN}"></div>`  : ''}
                </div>
                <div class="nc-minibar-legend">
                  ${doneN ? `<span class="nc-leg nc-leg--ok">${doneN} done</span>` : ''}
                  ${warnN ? `<span class="nc-leg nc-leg--warn">${warnN} ongoing</span>` : ''}
                  ${lowN  ? `<span class="nc-leg nc-leg--bad">${lowN} low</span>`  : ''}
                </div>
              </div>` : ''}

              <!-- ⑦ delay alert — only if delayed -->
              ${hasDelays ? `
              <div class="nc-alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                <span>${esc(g.generalDelays)}</span>
              </div>` : ''}

              <!-- ⑧ comment -->
              ${hasComment ? `<div class="nc-comment">${esc(g.generalComment)}</div>` : ''}

              <!-- ⑨ expand -->
              <button class="nc-toggle rtog" data-t="rc-${globalIdx}" onclick="event.stopPropagation()">
                <span class="nc-toggle-txt">Show ${items.length} ${items.length===1?'activity':'activities'}</span>
                <svg class="rchev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>

              <!-- ⑩ items panel -->
              <div id="rc-${globalIdx}" class="nc-items hidden">
                ${items.map((item, iIdx) => {
                  const ip = Math.min(Math.max(Number(item.progress)||0,0),100);
                  const ic = ip>=80?'ok':ip>=45?'warn':'bad';
                  const isExt = item.laborSourceType !== 'In-House';
                  return `
                  <div class="nc-item">
                    <div class="nc-item-row">
                      <span class="nc-item-num">${item.itemNo||iIdx+1}</span>
                      <div class="nc-item-info">
                        <span class="nc-item-name">${esc(item.element||'—')}</span>
                        <span class="nc-item-sub">${esc(item.activity||'—')}${item.level?' · '+esc(item.level):''}</span>
                      </div>
                      <span class="nc-item-pct nc-item-pct--${ic}">${ip}%</span>
                    </div>
                    <div class="nc-item-bar"><div class="nc-item-bar-fill nc-item-bar-fill--${ic}" style="width:${ip}%"></div></div>
                    <div class="nc-item-tags">
                      ${item.shiftType ? (function(){ var sc=item.shiftType==='Night'?'background:rgba(99,102,241,0.1);color:#a5b4fc;border-color:rgba(99,102,241,0.25)':'background:rgba(201,168,76,0.1);color:#c9a84c;border-color:rgba(201,168,76,0.2)'; var ico=item.shiftType==='Night'?'🌙':'☀️'; var t=item.startTime&&item.endTime?' · '+esc(fmt12(item.startTime))+' – '+esc(fmt12(item.endTime)):''; return '<span class="nc-tag" style="'+sc+'">'+ico+' '+esc(item.shiftType)+t+'</span>'; })() : ''}
                      ${(()=>{ const grand=(item.totalManpower||0)+(item.externalTotalManpower||0); const isEx=item.laborSourceType==='Supplier'||item.laborSourceType==='Subcontractor'; if(!grand) return ''; const detail=isEx&&item.externalTotalManpower>0&&item.totalManpower>0?' ('+item.externalTotalManpower+' ext + '+item.totalManpower+' in-house)':''; return '<span class="nc-tag">'+grand+' workers'+detail+'</span>'; })()}
                      <span class="nc-tag ${isExt?'nc-tag--ext':''}">${esc(item.laborSourceType||'In-House')}</span>
                      ${item.sourceCompanyName?`<span class="nc-tag nc-tag--co">${esc(item.sourceCompanyName)}</span>`:''}
                    </div>
                    ${item.itemComment?`<div class="nc-item-note">${esc(item.itemComment)}</div>`:''}
                  </div>`;
                }).join('')}
              </div>

            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');

    box.querySelectorAll('.rtog').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.t);
        if(!target) return;
        const hidden = target.classList.contains('hidden');
        target.classList.toggle('hidden');
        btn.querySelector('.rchev').style.transform = hidden ? 'rotate(180deg)' : '';
        btn.querySelector('.nc-toggle-txt').textContent = hidden
          ? `Hide activities`
          : `Show ${target.querySelectorAll('.nc-item').length} ${target.querySelectorAll('.nc-item').length===1?'activity':'activities'}`;
      });
    });
  }

  /* ─── Table ─── */
  function renderTable(rows) {
    const body = $('#detailTableBody'), empty = $('#tableEmpty');
    if(!rows?.length) { body.innerHTML=''; empty?.classList.remove('hidden'); return; }
    empty?.classList.add('hidden');
    body.innerHTML = rows.map(r=>`
      <tr>
        <td class="px-4 py-3 whitespace-nowrap font-mono text-gold font-medium text-xs">${esc(r.reportId||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap">${d(r.date)}</td>
        <td class="px-4 py-3 whitespace-nowrap">
          ${r.shiftType ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.05em;${r.shiftType==='Night'?'background:rgba(99,102,241,0.12);color:#a5b4fc':'background:rgba(201,168,76,0.12);color:#c9a84c'}">${r.shiftType==='Night'?'🌙 ':'☀️ '}${esc(r.shiftType)}</span>` : '—'}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-xs" style="font-variant-numeric:tabular-nums;color:rgba(255,255,255,0.45)">
          ${r.startTime && r.endTime ? esc(fmt12(r.startTime))+' – '+esc(fmt12(r.endTime)) : '—'}
          ${r.shiftDurationMinutes > 0 ? `<span style="color:rgba(201,168,76,0.6);margin-left:4px">(${Math.floor(r.shiftDurationMinutes/60)}h${r.shiftDurationMinutes%60?' '+r.shiftDurationMinutes%60+'m':''})</span>` : ''}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.engineerName||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap font-medium text-white">${esc(r.siteName||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap text-center">${n(r.itemNo)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.element||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.level||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.activity||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap font-semibold">${pct(r.progress)}</td>
        <td class="px-4 py-3 whitespace-nowrap">${n((r.totalManpower||0)+(r.externalTotalManpower||0))}${r.externalTotalManpower>0?`<span style='font-size:9px;color:rgba(96,165,250,0.6);margin-left:3px'>(${r.externalTotalManpower}+${r.totalManpower||0})</span>`:''}</td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.laborSourceType||'—')}</td>
        <td class="px-4 py-3 whitespace-nowrap">${esc(r.sourceCompanyName||'—')}</td>
      </tr>`).join('');
  }

  function filterTable(q) {
    q = (q||'').trim().toLowerCase();
    if(!q) { renderTable(currentTableRows); return; }
    renderTable(currentTableRows.filter(r =>
      [r.reportId,r.engineerName,r.siteName,r.element,r.level,r.activity,r.laborSourceType,r.sourceCompanyName].join(' ').toLowerCase().includes(q)
    ));
  }

  /* ─── Export — CORRECT ROUTE ─── */
  function doExport() {
    const params = new URLSearchParams();
    const ids = ['fFromDate','fToDate','fProject','fEngineer','fActivity','fLevel','fSourceType','fSearch'];
    const keys = ['fromDate','toDate','project','engineer','activity','level','sourceType','search'];
    ids.forEach((id,i) => { const v=$(`#${id}`)?.value; if(v) params.set(keys[i],v); });
    window.location.href = `/api/admin/export/excel?${params}`;
  }

  /* ─── Events ─── */
  $('#applyFilters')?.addEventListener('click', loadDashboard);
  $('#clearFilters')?.addEventListener('click', () => {
    ['fFromDate','fToDate','fProject','fEngineer','fActivity','fLevel','fSourceType','fSearch'].forEach(id => { const e=$(`#${id}`); if(e)e.value=''; });
    loadDashboard();
  });
  $('#exportBtn')?.addEventListener('click', doExport);
  $('#tableSearch')?.addEventListener('input', e => filterTable(e.target.value));
  $('#fSearch')?.addEventListener('keydown', e => { if(e.key==='Enter') loadDashboard(); });

  /* ─── Missing Report Alert ─── */
  async function loadAlert() {
    // Server sets this flag — skip entirely if user has no alert permission
    if (!window.SITE_CONFIG?.canViewAlerts) { hideAlert(); return; }
    try {
      const res  = await fetch('/api/admin/alert');
      const data = await res.json();
      if (!data.success || !data.alert) { hideAlert(); return; }
      showAlert(data.alert);
    } catch (_) { /* silent fail */ }
  }

  function showAlert(alert) {
    const banner = document.querySelector('#alertBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    banner.style.display = 'block';
    banner.dataset.alertDate = alert.date;
    const countBadge = document.querySelector('#alertCountBadge');
    if (countBadge) countBadge.textContent = alert.totalMissing + ' of ' + alert.totalEngineers + ' engineers';
    const dateBadge = document.querySelector('#alertDateBadge');
    if (dateBadge) {
      const d = new Date(alert.date + 'T00:00:00');
      dateBadge.textContent = '— ' + d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    }
    const container = document.querySelector('#alertEngineers');
    if (container) {
      container.innerHTML = alert.missingEngineers.map(function(name) {
        return '<span class="alert-chip">' + esc(name) + '</span>';
      }).join('');
    }
  }

  function hideAlert() {
    const b = document.querySelector('#alertBanner');
    if (b) b.classList.add('hidden');
  }

  window.dismissAlert = async function () {
    const banner = document.querySelector('#alertBanner');
    const date   = banner && banner.dataset.alertDate;
    hideAlert();
    try {
      await fetch('/api/admin/alert/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date })
      });
    } catch (_) {}
  };

  window.triggerAlertCheck = async function () {
    if (!window.SITE_CONFIG?.canViewAlerts) return;
    const btn   = document.querySelector('#alertRefreshBtn');
    const label = document.querySelector('#alertRefreshLabel');
    if (btn) { btn.disabled = true; if (label) label.textContent = 'Checking…'; }
    try {
      const res  = await fetch('/api/admin/alert/check', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.alert) showAlert(data.alert);
      else hideAlert();
    } catch (_) {}
    if (btn) { btn.disabled = false; if (label) label.textContent = 'Refresh'; }
  };

  /* ─── Init ─── */
  console.log('Dashboard script loaded');
  setTimeout(loadAlert, 500);
  loadDashboard();
  
  
})();