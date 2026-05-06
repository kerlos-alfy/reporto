/**
 * ag-custom-select.js
 * Wraps every <select> in the app with a styled trigger
 * that works consistently across ALL browsers.
 *
 * How it works:
 *   - Wraps each <select> in .ag-custom-select-wrap
 *   - Renders a visible .ag-cs-trigger div that mirrors the selected value
 *   - The real <select> sits on top (opacity:0) so native browser open/close
 *     still works perfectly — including mobile, keyboard, accessibility
 *   - On change/focus/blur → updates the trigger display
 *
 * Skips selects that:
 *   - Already have data-no-custom="true"
 *   - Are inside .ag-custom-select-wrap already
 *   - Are hidden (type="hidden")
 */

(function () {
  'use strict';

  const ARROW_SVG = `<svg class="ag-cs-arrow" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  function getSelectedLabel(select) {
    const opt = select.options[select.selectedIndex];
    if (!opt) return '';
    return opt.text || opt.value || '';
  }

  function isPlaceholder(select) {
    const opt = select.options[select.selectedIndex];
    if (!opt) return true;
    return opt.value === '' || opt.dataset.placeholder === 'true';
  }

  function updateTrigger(wrap, select, trigger) {
    const label = getSelectedLabel(select);
    const valueEl = trigger.querySelector('.ag-cs-value');
    if (!valueEl) return;
    valueEl.textContent = label || '—';
    if (isPlaceholder(select)) {
      valueEl.classList.add('placeholder');
    } else {
      valueEl.classList.remove('placeholder');
    }
  }

  function wrapSelect(select) {
    // Skip if already wrapped, hidden, or opted out
    if (select.closest('.ag-custom-select-wrap')) return;
    if (select.type === 'hidden') return;
    if (select.dataset.noCustom === 'true') return;
    if (select.style.display === 'none') return;

    // Create wrapper
    const wrap = document.createElement('div');
    wrap.className = 'ag-custom-select-wrap';

    // Size hint from original select
    if (select.dataset.size === 'sm' || select.classList.contains('text-xs') || select.classList.contains('text-[11px]')) {
      wrap.classList.add('sm');
    } else if (select.dataset.size === 'lg' || select.classList.contains('text-base') || select.classList.contains('text-[15px]')) {
      wrap.classList.add('lg');
    }

    // Preserve width/flex styles from original
    const computedStyle = window.getComputedStyle(select);
    const origWidth = select.style.width || (computedStyle.width !== 'auto' ? computedStyle.width : '');

    // Build visible trigger
    const trigger = document.createElement('div');
    trigger.className = 'ag-cs-trigger';
    trigger.setAttribute('aria-hidden', 'true');
    trigger.innerHTML = `<span class="ag-cs-value"></span>${ARROW_SVG}`;

    // Insert wrapper before select in DOM
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    wrap.appendChild(trigger);

    // Initial state
    updateTrigger(wrap, select, trigger);

    // Sync on change
    select.addEventListener('change', () => updateTrigger(wrap, select, trigger));

    // Focus / blur for ring effect
    select.addEventListener('focus', () => wrap.classList.add('focused'));
    select.addEventListener('blur',  () => wrap.classList.remove('focused'));

    // Also handle mousedown open (some browsers fire change late)
    select.addEventListener('mousedown', () => {
      // Slight delay to catch value after open
      setTimeout(() => updateTrigger(wrap, select, trigger), 50);
    });
  }

  function initAll(root) {
    const selects = (root || document).querySelectorAll('select');
    selects.forEach(wrapSelect);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }

  // Re-run when new selects are added dynamically (work item cards etc.)
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'SELECT') {
            wrapSelect(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('select').forEach(wrapSelect);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose globally for manual re-init if needed
  window.agInitSelects = initAll;
})();
