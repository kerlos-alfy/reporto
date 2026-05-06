/**
 * theme.js — Agile Prime Theme Switcher
 * - Applies theme immediately from localStorage (zero flicker)
 * - Syncs choice to DB via /api/theme (fire-and-forget)
 * - Handles the swatch panel open/close
 */

(function () {
  const THEMES = ['navy', 'cyan', 'amber'];
  const LS_KEY = 'ag_theme';

  // ── Apply theme to <html> ──────────────────────────────────────────
  function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'navy';
    document.documentElement.setAttribute('data-theme', theme);
    // also update tailwind's dark mode class for light theme
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem(LS_KEY, theme);
  }

  // ── Save to DB (fire and forget, best-effort) ─────────────────────
  function saveThemeToDB(theme) {
    fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ theme }),
    }).catch(() => {}); // silently ignore if not logged in yet
  }

  // ── Switch theme (called by swatches) ────────────────────────────
  window.setTheme = function (theme) {
    applyTheme(theme);
    saveThemeToDB(theme);
    // update active swatch
    document.querySelectorAll('.ag-theme-swatch').forEach(el => {
      el.classList.toggle('active', el.dataset.t === theme);
    });
    // close panel
    const panel = document.getElementById('ag-theme-panel');
    if (panel) panel.classList.add('hidden');
  };

  // ── Toggle panel ─────────────────────────────────────────────────
  window.toggleThemePanel = function (e) {
    e.stopPropagation();
    const panel = document.getElementById('ag-theme-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    // mark active swatch
    const current = document.documentElement.getAttribute('data-theme') || 'navy';
    document.querySelectorAll('.ag-theme-swatch').forEach(el => {
      el.classList.toggle('active', el.dataset.t === current);
    });
  };

  // close panel on outside click
  document.addEventListener('click', function () {
    const panel = document.getElementById('ag-theme-panel');
    if (panel) panel.classList.add('hidden');
  });

  // ── Init: apply saved theme immediately ──────────────────────────
  // (server sets data-theme on <html> server-side, but this handles
  //  cases where the server value differs from localStorage)
  const saved = localStorage.getItem(LS_KEY);
  if (saved && THEMES.includes(saved)) {
    applyTheme(saved);
  }

})();
