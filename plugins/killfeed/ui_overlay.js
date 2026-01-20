/**
 * Killfeed Plugin - Overlay UI Script
 * Draggable badges with live stats display
 */

(function() {
  'use strict';

  window.addEventListener('error', (e) => {
    console.error('[Killfeed Overlay] error', e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Killfeed Overlay] unhandled', e.reason);
  });

  function unwrap(result) {
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) return result.data;
      throw new Error(result.error || 'IPC call failed');
    }
    return result;
  }

  // Schema constants (mirrored from shared/schema.js for browser)
  const BADGE_KEYS = [
    'killsSession', 'killsTotal', 'killsPerHour', 'killsPerMin',
    'expLastKill', 'expTotal', 'expPerHour', 'expPerMin',
    'killsToLevel', 'sessionDuration', 'expSession', 'currentExp', 'rmExp',
    'avgTimePerKill', 'timeSinceLastKill', 'last3Kills',
    'resetSession'
  ];
  // Overlay only shows data badges, no reset control
  const OVERLAY_BADGE_KEYS = BADGE_KEYS.filter(k => k !== 'resetSession');

  const BADGE_LABELS = {
    killsSession: 'Kills',
    killsTotal: 'Total',
    killsPerHour: 'K/h',
    killsPerMin: 'K/m',
    expLastKill: 'Last',
    expTotal: 'EXP Day',
    expPerHour: 'E/h',
    expPerMin: 'E/m',
    currentExp: 'EXP',
    killsToLevel: 'To Lvl',
    sessionDuration: 'Time',
    expSession: 'Sess',
    avgTimePerKill: 'Avg',
    timeSinceLastKill: 'Idle',
    rmExp: 'RM EXP',
    last3Kills: 'Recent',
    resetSession: 'Reset'
  };

  // DOM elements
  const overlayContainer = document.getElementById('overlayContainer');
  const badgeGrid = document.getElementById('badgeGrid');

  // State
  let currentProfileId = null;
  let currentBrowserViewId = null;
  let currentStats = null;
  let currentLayout = null;
  let previousValues = {};
  let layoutHash = null;
  let widthSyncRaf = null;
  let currentScale = 1;

  // Drag state
  let draggedElement = null;
  let draggedIndex = -1;

  /**
   * Format value for display
   */
  function formatValue(key, stats) {
    if (!stats) return '-';

    switch (key) {
      case 'killsSession':
      case 'killsTotal':
      case 'killsToLevel':
        return stats[key]?.toLocaleString() || '0';

      case 'killsPerHour':
        return (stats[key] || 0).toFixed(1);

      case 'killsPerMin':
        return (stats[key] || 0).toFixed(2);

      case 'expLastKill':
        return stats.expLastKillFormatted || '0.0000%';

      case 'expTotal':
      case 'expSession':
      case 'expPerHour':
      case 'expPerMin':
      case 'currentExp':
        return (stats[key] || 0).toFixed(4) + '%';
      case 'rmExp':
        if (stats.rmExp === null || stats.rmExp === undefined || stats.rmExp === '') return '-';
        if (typeof stats.rmExp === 'number') return stats.rmExp.toFixed(4) + '%';
        return String(stats.rmExp);

      case 'sessionDuration':
        return stats.sessionDurationFormatted || '0:00';

      case 'avgTimePerKill':
        return stats.avgTimePerKillFormatted || '0:00';

      case 'timeSinceLastKill':
        return stats.timeSinceLastKillFormatted || '-';

      case 'last3Kills':
        return null; // Special handling

      case 'resetSession':
        return 'Reset';

      default:
        return String(stats[key] || '-');
    }
  }

  function clampScale(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.6, Math.max(0.6, n));
  }

  function applyScale() {
    const scale = clampScale(currentLayout?.scale ?? 1);
    currentScale = scale;
    if (badgeGrid) {
      badgeGrid.style.transform = `scale(${scale})`;
      badgeGrid.style.transformOrigin = 'top left';
    }
  }

  /**
   * Create badge element
   */
  function createBadgeElement(key) {
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.dataset.badgeKey = key;
    badge.draggable = key !== 'resetSession';
    badge.style.pointerEvents = 'auto';

    if (key === 'last3Kills') {
      badge.classList.add('last3kills');
      badge.innerHTML = `
        <span class="badge-label">${BADGE_LABELS[key]}</span>
        <div class="kills-container"></div>
      `;
    } else {
      badge.innerHTML = `
        <span class="badge-label">${BADGE_LABELS[key]}</span>
        <span class="badge-value">-</span>
      `;
    }

    return badge;
  }

  /**
   * Update badge value with animation
   */
  function updateBadgeValue(badge, key, stats) {
    if (key === 'last3Kills') {
      const container = badge.querySelector('.kills-container');
      if (!container) return;

      const kills = stats?.last3Kills || [];
      container.innerHTML = kills.length > 0
        ? kills.map(k => `
            <div class="kill-entry">
              <span class="monster-name" title="${k.monsterName}">${k.monsterName}</span>
              <span class="kill-exp">${k.deltaExpFormatted}</span>
            </div>
          `).join('')
        : '<span style="color: rgba(255,255,255,0.5); font-size: 11px;">No kills yet</span>';
    } else {
      const valueEl = badge.querySelector('.badge-value');
      if (!valueEl) return;

      const newValue = formatValue(key, stats);
      const oldValue = previousValues[key];

      if (newValue !== oldValue) {
        valueEl.textContent = newValue;
        previousValues[key] = newValue;

        // Trigger pulse animation on change
        if (key !== 'timeSinceLastKill' && key !== 'sessionDuration') {
          valueEl.classList.remove('updated');
          void valueEl.offsetWidth; // Force reflow
          valueEl.classList.add('updated');
        }
      }
    }
  }

  /**
   * Render all badges
   */
  function renderBadges() {
    previousValues = {};
    const order = currentLayout?.order && currentLayout.order.length ? currentLayout.order : OVERLAY_BADGE_KEYS;
    const defaultVisibility = OVERLAY_BADGE_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {});
    let visibility = { ...(currentLayout?.visibility || {}) };
    const anyVisible = order.some(key => visibility[key] !== false);
    if (!anyVisible) {
      visibility = { ...defaultVisibility };
      if (currentLayout) currentLayout.visibility = visibility;
    }

    const filteredOrder = order.filter(k => k !== 'resetSession');
    const visibleCount = filteredOrder.filter(key => visibility[key] !== false).length || filteredOrder.length;
    const rows = Math.max(1, Math.floor(Number(currentLayout?.rows) || 1));
    const columns = Math.max(1, Math.ceil(visibleCount / rows));
    badgeGrid.style.display = 'grid';
    badgeGrid.style.gridTemplateColumns = `repeat(${columns}, var(--badge-width, max-content))`;
    applyScale();

    // Clear and rebuild
    badgeGrid.innerHTML = '';

    for (const key of filteredOrder) {
      const badge = createBadgeElement(key);
      const isVisible = visibility[key] !== false;

      if (!isVisible) {
        badge.classList.add('hidden');
      }

      updateBadgeValue(badge, key, currentStats);
      badgeGrid.appendChild(badge);
    }

    // Setup drag handlers
    setupDragHandlers();

    scheduleWidthSync();
  }

  /**
   * Update all badge values without re-rendering structure
   */
  function updateBadgeValues() {
    const badges = badgeGrid.querySelectorAll('.badge');

    badges.forEach(badge => {
      const key = badge.dataset.badgeKey;
      updateBadgeValue(badge, key, currentStats);
    });

    scheduleWidthSync();
  }

  /**
   * Update badge visibility
   */
  function updateVisibility() {
    const visibility = currentLayout?.visibility || {};
    const overlayVisible = currentLayout?.overlayVisible !== false;
    applyScale();

    // Apply global overlay visibility to the entire container
    if (overlayVisible) {
      overlayContainer.classList.remove('hidden');
      badgeGrid.classList.remove('hidden');
    } else {
      overlayContainer.classList.add('hidden');
      badgeGrid.classList.add('hidden');
      return; // No need to update individual badges if everything is hidden
    }

    // Update individual badges
    const badges = badgeGrid.querySelectorAll('.badge');
    badges.forEach(badge => {
      const key = badge.dataset.badgeKey;
      if (visibility[key] === false) {
        badge.classList.add('hidden');
      } else {
        badge.classList.remove('hidden');
      }
    });

    scheduleWidthSync();
  }

  /**
   * Setup drag and drop handlers
   */
  function setupDragHandlers() {
    const badges = badgeGrid.querySelectorAll('.badge');

    badges.forEach((badge, index) => {
      badge.addEventListener('dragstart', handleDragStart);
      badge.addEventListener('dragend', handleDragEnd);
      badge.addEventListener('dragover', handleDragOver);
      badge.addEventListener('drop', handleDrop);
    });
  }

  function handleDragStart(e) {
    draggedElement = e.target.closest('.badge');
    draggedIndex = Array.from(badgeGrid.children).indexOf(draggedElement);
    draggedElement.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedElement.dataset.badgeKey);
  }

  function handleDragEnd(e) {
    if (draggedElement) {
      draggedElement.classList.remove('dragging');
    }

    // Get new order and save
    const newOrder = Array.from(badgeGrid.querySelectorAll('.badge'))
      .map(el => el.dataset.badgeKey);

    saveLayout({ order: newOrder });

    draggedElement = null;
    draggedIndex = -1;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetBadge = e.target.closest('.badge');
    if (!targetBadge || targetBadge === draggedElement) return;

    const rect = targetBadge.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    // Insert before or after based on cursor position
    if (e.clientX < midX) {
      badgeGrid.insertBefore(draggedElement, targetBadge);
    } else {
      badgeGrid.insertBefore(draggedElement, targetBadge.nextSibling);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
  }

  /**
   * Save layout to plugin
   */
  async function saveLayout(layoutUpdate) {
    if (!currentProfileId) return;

    try {
      await unwrap(window.plugin.ipc.invoke('layout:set', currentProfileId, layoutUpdate));
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }

  /**
   * Bind overlay to a profile/browserview
   */
  async function bind(browserViewId, profileId) {
    currentBrowserViewId = browserViewId;
    currentProfileId = profileId;

    try {
      await unwrap(window.plugin.ipc.invoke('overlay:bind', browserViewId, profileId));
      await requestState();
    } catch (err) {
      console.error('Failed to bind overlay:', err);
    }
  }

  /**
   * Request current state
   */
  async function requestState() {
    if (!currentProfileId) return;

    try {
      const data = unwrap(await window.plugin.ipc.invoke('overlay:request:state', currentProfileId));
      if (!data || !data.stats) return;

      currentStats = data.stats;

      const nextLayout = data.layout || currentLayout;
      const nextHash = nextLayout ? JSON.stringify(nextLayout) : null;
      const changedLayout = nextHash !== layoutHash;
      if (nextLayout) {
        currentLayout = nextLayout;
        if (currentLayout.overlayVisible === undefined) {
          currentLayout.overlayVisible = true;
        }
        if (!currentLayout.visibility) {
          currentLayout.visibility = {};
        }
        const hasVisible = (currentLayout.order && currentLayout.order.length
          ? currentLayout.order
          : OVERLAY_BADGE_KEYS).some(k => currentLayout.visibility[k] !== false);
        if (!hasVisible) {
          currentLayout.visibility = OVERLAY_BADGE_KEYS.reduce((acc, k) => {
            acc[k] = true;
            return acc;
          }, {});
        }
        if (!currentLayout.rows || currentLayout.rows <= 0) {
          currentLayout.rows = 2;
        }
        layoutHash = nextHash;
      }

      if (!badgeGrid.children.length || changedLayout) {
        renderBadges();
        updateVisibility();
      } else {
        updateBadgeValues();
        updateVisibility();
      }
    } catch (err) {
      console.error('Failed to request state:', err);
    }
  }

  /**
   * Handle state update broadcast
   */
  function handleStateUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    currentStats = payload.stats;
    if (payload.layout) {
      currentLayout = payload.layout;
      layoutHash = JSON.stringify(payload.layout);
      updateVisibility();
    }
    updateBadgeValues();
  }

  /**
   * Handle visibility update broadcast
   */
  function handleVisibilityUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    if (currentLayout) {
      currentLayout.visibility = payload.visibility;
      currentLayout.overlayVisible = payload.overlayVisible;
      layoutHash = JSON.stringify(currentLayout);
    }
    updateVisibility();
  }

  /**
   * Handle layout update broadcast
   */
  function handleLayoutUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    currentLayout = payload.layout;
    if (currentLayout && currentLayout.overlayVisible === undefined) {
      currentLayout.overlayVisible = true;
    }
    layoutHash = JSON.stringify(payload.layout);
    renderBadges();
    updateVisibility();
  }

  /**
   * Measure widest visible badge and force all to that width
   */
  function syncBadgeWidths() {
    const badges = Array.from(badgeGrid.querySelectorAll('.badge')).filter(b => !b.classList.contains('hidden'));
    if (!badges.length) return;

    badges.forEach(b => { b.style.width = ''; });
    let maxWidth = 0;
    badges.forEach(b => {
      const rect = b.getBoundingClientRect();
      if (rect.width > maxWidth) maxWidth = rect.width;
    });

    if (maxWidth > 0) {
      const widthPx = `${Math.ceil(maxWidth)}px`;
      badgeGrid.style.setProperty('--badge-width', widthPx);
      badges.forEach(b => { b.style.width = widthPx; });
    }
  }

  function scheduleWidthSync() {
    if (widthSyncRaf) cancelAnimationFrame(widthSyncRaf);
    widthSyncRaf = requestAnimationFrame(() => {
      widthSyncRaf = null;
      syncBadgeWidths();
    });
  }

  /**
   * Initialize the overlay
   */
  async function init() {
    console.log('[Killfeed Overlay] init');

    // Get binding info from URL params or defaults
    const params = new URLSearchParams(window.location.search);
    const browserViewId = params.get('browserViewId') || 'default';
    const profileId = params.get('profileId') || 'default';

    await bind(browserViewId, profileId);

    // Poll for updates since plugin UI can't receive broadcasts
    setInterval(async () => {
      if (currentProfileId) {
        await requestState();
      }
    }, 500);
  }

  // Expose global functions for external calls (IPC from launcher)
  window.KillfeedOverlay = {
    bind,
    requestState
  };

  // Initialize on load
  window.addEventListener('load', init);
})();
