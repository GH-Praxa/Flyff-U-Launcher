/**
 * Killfeed Plugin - Sidepanel UI Script
 */

(function() {
  'use strict';

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

  const BADGE_LABELS = {
    killsSession: 'Kills (Session)',
    killsTotal: 'Kills (Total)',
    killsPerHour: 'Kills/Hour',
    killsPerMin: 'Kills/Min',
    expLastKill: 'EXP Last Kill',
    expTotal: 'EXP Today',
    expPerHour: 'EXP/Hour',
    expPerMin: 'EXP/Min',
    currentExp: 'EXP Current',
    killsToLevel: 'Kills to Level',
    sessionDuration: 'Session Time',
    expSession: 'EXP (Session)',
    avgTimePerKill: 'Avg Time/Kill',
    timeSinceLastKill: 'Since Last Kill',
    rmExp: 'RM EXP',
    last3Kills: 'Last 3 Kills',
    resetSession: 'Reset Session'
  };

  const MONSTER_RANKS = {
    normal: 'Normal',
    giant: 'Giants',
    violet: 'Violets',
    boss: 'Bosses',
    unknown: 'Unknown'
  };

  // DOM elements
  const profileSelector = document.getElementById('profileSelector');
  const badgeListEl = document.getElementById('badgeList');
  const monstersContainer = document.getElementById('monstersContainer');
  const toggleAllBtn = document.getElementById('toggleAllBtn');
  const resetSessionBtn = document.getElementById('resetSessionBtn');
  const rowsInput = document.getElementById('rowsInput');
  const sessionInfoEl = document.getElementById('sessionInfo');
  const scaleInput = document.getElementById('scaleInput');
  const scaleValue = document.getElementById('scaleValue');
  const charNameInput = document.getElementById('charNameInput');
  const charNameStatus = document.getElementById('charNameStatus');

  // State
  let currentProfileId = null;
  let currentStats = null;
  let currentLayout = null;
  let charNameDebounce = null;

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
      if (!stats.last3Kills || stats.last3Kills.length === 0) return '-';
      return stats.last3Kills.map(k => k.monsterName).join(', ');

    case 'resetSession':
      return 'Reset';

    default:
      return String(stats[key] || '-');
  }
}

  /**
   * Render badge visibility list
   */
  function renderBadgeList() {
    const visibility = currentLayout?.visibility || {};
    const allVisible = BADGE_KEYS.every(k => visibility[k] !== false);
    const anyVisible = BADGE_KEYS.some(k => visibility[k] !== false);

    let html = `
      <div class="badge-item">
        <input type="checkbox" id="vis-all" data-key="__all__" ${allVisible ? 'checked' : ''}>
        <label for="vis-all">Alle</label>
        <span class="badge-value">${allVisible ? 'On' : anyVisible ? 'Mixed' : 'Off'}</span>
      </div>
    `;

    html += BADGE_KEYS.map(key => {
      const isVisible = visibility[key] !== false;
    const value = formatValue(key, currentStats);

      return `
        <div class="badge-item">
          <input type="checkbox" id="vis-${key}" data-key="${key}" ${isVisible ? 'checked' : ''}>
          <label for="vis-${key}">${BADGE_LABELS[key]}</label>
          <span class="badge-value">${value}</span>
        </div>
      `;
    }).join('');

    badgeListEl.innerHTML = html;

    // Add event listeners
    badgeListEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        const visible = e.target.checked;
        if (key === '__all__') {
          setAllVisibility(visible);
        } else {
          setVisibility(key, visible);
        }
      });
    });

    // Set indeterminate state
    const allCb = document.getElementById('vis-all');
    if (allCb) {
      allCb.indeterminate = !allVisible && anyVisible;
    }
  }

  /**
   * Render monster accordions
   */
  function renderMonsters() {
    const monstersByRank = currentStats?.monstersByRank || {};

    const ranks = ['normal', 'giant', 'violet', 'boss', 'unknown'];

    monstersContainer.innerHTML = ranks.map(rank => {
      const monsters = monstersByRank[rank] || [];
      const count = monsters.length;
      const isOpen = count > 0;

      const monsterListHtml = monsters.length > 0
        ? monsters.map(m => `
            <div class="monster-item">
              <span class="name" title="${m.name}">${m.name}</span>
              <span class="kill-count">${m.count}</span>
            </div>
          `).join('')
        : '<div class="empty-state">No monsters yet</div>';

      return `
        <div class="accordion" data-rank="${rank}">
          <div class="accordion-header ${isOpen ? 'open' : ''}" onclick="toggleAccordion('${rank}')">
            <span class="title">
              <span class="rank-${rank}">${MONSTER_RANKS[rank]}</span>
              <span class="count">${count}</span>
            </span>
            <span class="chevron">&#9660;</span>
          </div>
          <div class="accordion-content ${isOpen ? 'open' : ''}">
            <div class="monster-list">
              ${monsterListHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Toggle accordion open/closed
   */
  window.toggleAccordion = function(rank) {
    const accordion = monstersContainer.querySelector(`.accordion[data-rank="${rank}"]`);
    if (!accordion) return;

    const header = accordion.querySelector('.accordion-header');
    const content = accordion.querySelector('.accordion-content');

    header.classList.toggle('open');
    content.classList.toggle('open');
  };

  /**
   * Update session info display
   */
  function updateSessionInfo() {
    if (!currentStats) {
      sessionInfoEl.textContent = 'No data';
      return;
    }

    const duration = currentStats.sessionDurationFormatted || '0:00';
    const kills = currentStats.killsSession || 0;
    sessionInfoEl.textContent = `Session: ${duration} | ${kills} kills`;
  }

  function setCharStatus(text, state = 'info') {
    if (!charNameStatus) return;
    charNameStatus.textContent = text;
    charNameStatus.classList.remove('ok', 'error');
    if (state === 'ok') {
      charNameStatus.classList.add('ok');
    } else if (state === 'error') {
      charNameStatus.classList.add('error');
    }
  }

  async function loadCharName() {
    if (!currentProfileId) return;
    try {
      const result = unwrap(await window.plugin.ipc.invoke('char:get', currentProfileId));
      if (charNameInput && typeof result?.charName === 'string') {
        charNameInput.value = result.charName;
        setCharStatus(result.charName ? 'Gespeichert' : 'Noch nicht gespeichert', result.charName ? 'ok' : 'info');
      }
    } catch (err) {
      setCharStatus('Charname konnte nicht geladen werden', 'error');
    }
  }

  async function saveCharName() {
    if (!currentProfileId) return;
    const value = (charNameInput?.value || '').trim();
    try {
      const result = unwrap(await window.plugin.ipc.invoke('char:set', currentProfileId, value));
      setCharStatus(result?.charName ? 'Gespeichert' : 'Noch nicht gespeichert', result?.charName ? 'ok' : 'info');
    } catch (err) {
      setCharStatus('Speichern fehlgeschlagen', 'error');
    }
  }

  /**
   * Set visibility for a badge
   */
  async function setVisibility(badgeKey, visible) {
    if (!currentProfileId) return;

    try {
      await unwrap(window.plugin.ipc.invoke('vis:set', currentProfileId, badgeKey, visible));
    } catch (err) {
      console.error('Failed to set visibility:', err);
    }
  }

  /**
   * Toggle all badges visibility
   */
  async function toggleAll() {
    if (!currentProfileId) return;

    try {
      const result = unwrap(await window.plugin.ipc.invoke('overlay:toggle:all', currentProfileId));
      if (result?.success) {
        currentLayout.overlayVisible = result.overlayVisible;
        updateToggleButton();
      }
    } catch (err) {
      console.error('Failed to toggle all:', err);
    }
  }

  /**
   * Update toggle all button text
   */
  function updateToggleButton() {
    const isVisible = currentLayout?.overlayVisible !== false;
    toggleAllBtn.textContent = isVisible ? 'Hide All' : 'Show All';
  }

  /**
   * Update rows input from layout
   */
  function updateRowsInput() {
    const rows = currentLayout?.rows ? Math.max(1, Math.floor(currentLayout.rows)) : 1;
    if (rowsInput) {
      rowsInput.value = String(rows);
    }
  }

  /**
   * Clamp scale to supported range
   */
  function clampScale(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1.6, Math.max(0.6, n));
  }

  /**
   * Update scale slider from layout
   */
  function updateScaleInput() {
    const scale = clampScale(currentLayout?.scale ?? 1);
    if (scaleInput) {
      scaleInput.value = String(scale);
    }
    if (scaleValue) {
      scaleValue.textContent = scale.toFixed(2) + 'x';
    }
  }

  /**
   * Reset session counters (keeps lifetime totals)
   */
  async function resetSession() {
    if (!currentProfileId) return;
    try {
      await unwrap(window.plugin.ipc.invoke('session:reset', currentProfileId));
      await requestState();
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  }

  /**
   * Set all badge visibility at once
   */
  async function setAllVisibility(visible) {
    if (!currentProfileId) return;
    const visibilityMap = {};
    BADGE_KEYS.forEach(k => { visibilityMap[k] = visible; });
    try {
      await unwrap(window.plugin.ipc.invoke('layout:set', currentProfileId, { visibility: visibilityMap }));
      await requestState();
    } catch (err) {
      console.error('Failed to set all visibility:', err);
    }
  }

  /**
   * Bind to a profile
   */
  async function bindProfile(profileId) {
    if (!profileId) return;

    currentProfileId = profileId;

    try {
      await unwrap(window.plugin.ipc.invoke('panel:bind:profile', profileId));
      await requestState();
    } catch (err) {
      console.error('Failed to bind profile:', err);
    }
  }

  /**
   * Request current state
   */
  async function requestState() {
    if (!currentProfileId) return;

    try {
      const data = unwrap(await window.plugin.ipc.invoke('panel:request:state', currentProfileId));
      currentStats = data?.stats;
      currentLayout = data?.layout;
      if (data?.charName && charNameInput) {
        charNameInput.value = data.charName;
        setCharStatus(data.charName ? 'Gespeichert' : 'Noch nicht gespeichert', data.charName ? 'ok' : 'info');
      }
      render();
      updateRowsInput();
      updateScaleInput();
    } catch (err) {
      console.error('Failed to request state:', err);
    }
  }

  /**
   * Render all UI components
   */
  function render() {
    renderBadgeList();
    renderMonsters();
    updateSessionInfo();
    updateToggleButton();
    updateRowsInput();
    updateScaleInput();
  }

  /**
   * Handle state update broadcast
   */
function handleStateUpdate(payload) {
  if (payload.profileId !== currentProfileId) return;

  currentStats = payload.stats;
  if (payload.layout) {
    currentLayout = payload.layout;
  }
  if (payload.charName && charNameInput) {
    charNameInput.value = payload.charName;
    setCharStatus(payload.charName ? 'Gespeichert' : 'Noch nicht gespeichert', payload.charName ? 'ok' : 'info');
  }
  render();
}

  /**
   * Handle visibility update broadcast
   */
function handleVisibilityUpdate(payload) {
  if (payload.profileId !== currentProfileId) return;

  if (currentLayout) {
    currentLayout.visibility = payload.visibility;
    currentLayout.overlayVisible = payload.overlayVisible;
  }
  render();
}

  /**
   * Handle layout update broadcast
   */
  function handleLayoutUpdate(payload) {
    if (payload.profileId !== currentProfileId) return;

    currentLayout = payload.layout;
    updateScaleInput();
    render();
  }

  /**
   * Persist rows setting
   */
  async function setRowsFromInput() {
    if (!currentProfileId || !rowsInput) return;
    const rows = Math.max(1, Math.floor(Number(rowsInput.value) || 1));
    try {
      await unwrap(window.plugin.ipc.invoke('layout:set', currentProfileId, { rows }));
    } catch (err) {
      console.error('Failed to set rows:', err);
    }
  }

  /**
   * Persist scale setting from slider
   */
  async function setScaleFromInput() {
    if (!currentProfileId || !scaleInput) return;
    const scale = clampScale(scaleInput.value);
    try {
      await unwrap(window.plugin.ipc.invoke('layout:set', currentProfileId, { scale }));
      if (currentLayout) {
        currentLayout.scale = scale;
      }
    } catch (err) {
      console.error('Failed to set scale:', err);
    } finally {
      if (scaleValue) scaleValue.textContent = scale.toFixed(2) + 'x';
    }
  }

  /**
   * Initialize the panel
   */
  async function init() {
    // Setup event listeners
    toggleAllBtn.addEventListener('click', toggleAll);
    resetSessionBtn.addEventListener('click', resetSession);
    if (rowsInput) {
      rowsInput.addEventListener('change', setRowsFromInput);
    }
    if (scaleInput) {
      scaleInput.addEventListener('input', () => {
        const scale = clampScale(scaleInput.value);
        if (scaleValue) scaleValue.textContent = scale.toFixed(2) + 'x';
      });
      scaleInput.addEventListener('change', setScaleFromInput);
    }
    if (charNameInput) {
      const scheduleSave = () => {
        if (charNameDebounce) clearTimeout(charNameDebounce);
        charNameDebounce = setTimeout(() => {
          void saveCharName();
        }, 300);
      };
      charNameInput.addEventListener('input', scheduleSave);
      charNameInput.addEventListener('change', scheduleSave);
    }

    profileSelector.addEventListener('change', (e) => {
      bindProfile(e.target.value);
    });

    // Determine initial profile (prefer overlay target injected by host)
    const injectedProfile = typeof window.__overlayTargetId === 'string' && window.__overlayTargetId
      ? window.__overlayTargetId
      : null;
    const defaultProfileId = injectedProfile || 'default';
    profileSelector.innerHTML = `<option value="${defaultProfileId}">${injectedProfile ? injectedProfile : 'Default Profile'}</option>`;

    await bindProfile(defaultProfileId);
    await loadCharName();

    // Poll for updates since plugin UI can't receive broadcasts
    setInterval(async () => {
      if (currentProfileId) {
        await requestState();
        await loadCharName();
      }
    }, 1000);
  }

  // Initialize on load
  window.addEventListener('load', init);
})();
