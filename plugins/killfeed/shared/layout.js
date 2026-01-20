/**
 * Killfeed Plugin - Layout Manager
 * Handles badge ordering, positioning, visibility, and drag&drop persistence.
 */

const schema = typeof require !== 'undefined'
  ? require('./schema.js')
  : window.KillfeedSchema;

/**
 * Creates a layout manager for handling badge layouts
 * @param {function} onSave - Callback to persist layout changes
 * @returns {object} Layout manager instance
 */
function createLayoutManager(onSave) {
  let layout = schema.getDefaultLayout();
  let saveCallback = onSave || (() => {});

  /**
   * Set the save callback
   */
  function setSaveCallback(cb) {
    saveCallback = cb || (() => {});
  }

  /**
   * Get current layout
   */
  function getLayout() {
    return JSON.parse(JSON.stringify(layout));
  }

  /**
   * Set entire layout (from storage)
   */
  function setLayout(newLayout) {
    layout = schema.migrateLayout(newLayout);
    return layout;
  }

  /**
   * Reset to default layout
   */
  function resetLayout() {
    layout = schema.getDefaultLayout();
    saveCallback(layout);
    return layout;
  }

  /**
   * Get badge order
   */
  function getOrder() {
    return [...layout.order];
  }

  /**
   * Set badge order (after drag&drop reorder)
   */
  function setOrder(newOrder) {
    if (!Array.isArray(newOrder)) return;

    // Validate all keys exist
    const validKeys = new Set(schema.BADGE_KEYS);
    const filteredOrder = newOrder.filter(k => validKeys.has(k));

    // Ensure all keys are present
    for (const key of schema.BADGE_KEYS) {
      if (!filteredOrder.includes(key)) {
        filteredOrder.push(key);
      }
    }

    layout.order = filteredOrder;
    saveCallback(layout);
  }

  /**
   * Move a badge from one index to another
   */
  function moveBadge(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= layout.order.length) return;
    if (toIndex < 0 || toIndex >= layout.order.length) return;

    const item = layout.order.splice(fromIndex, 1)[0];
    layout.order.splice(toIndex, 0, item);
    saveCallback(layout);
  }

  /**
   * Get badge visibility
   */
  function getVisibility() {
    return { ...layout.visibility };
  }

  /**
   * Set single badge visibility
   */
  function setBadgeVisibility(badgeKey, visible) {
    if (!schema.BADGE_KEYS.includes(badgeKey)) return;

    layout.visibility[badgeKey] = Boolean(visible);
    saveCallback(layout);
  }

  /**
   * Set all badge visibilities at once
   */
  function setAllVisibility(visibilityMap) {
    for (const key of schema.BADGE_KEYS) {
      if (visibilityMap.hasOwnProperty(key)) {
        layout.visibility[key] = Boolean(visibilityMap[key]);
      }
    }
    saveCallback(layout);
  }

  /**
   * Set desired grid rows (>=1)
   */
  function setRows(rows) {
    const n = Math.max(1, Math.floor(Number(rows) || 1));
    layout.rows = n;
    saveCallback(layout);
    return n;
  }

  function getRows() {
    return Math.max(1, Math.floor(Number(layout.rows) || 1));
  }

  /**
   * Set overlay scale (0.5 - 2.0)
   */
  function setScale(scale) {
    const n = Number(scale);
    const clamped = Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : 1;
    layout.scale = clamped;
    saveCallback(layout);
    return clamped;
  }

  function getScale() {
    return Math.min(2, Math.max(0.5, Number(layout.scale) || 1));
  }

  /**
   * Toggle single badge visibility
   */
  function toggleBadgeVisibility(badgeKey) {
    if (!schema.BADGE_KEYS.includes(badgeKey)) return;

    layout.visibility[badgeKey] = !layout.visibility[badgeKey];
    saveCallback(layout);
    return layout.visibility[badgeKey];
  }

  /**
   * Check if badge is visible
   */
  function isBadgeVisible(badgeKey) {
    return layout.visibility[badgeKey] !== false;
  }

  /**
   * Get overlay visibility (global toggle)
   */
  function isOverlayVisible() {
    return layout.overlayVisible !== false;
  }

  /**
   * Set overlay visibility (global toggle)
   */
  function setOverlayVisible(visible) {
    layout.overlayVisible = Boolean(visible);
    saveCallback(layout);
  }

  /**
   * Toggle overlay visibility
   */
  function toggleOverlay() {
    layout.overlayVisible = !layout.overlayVisible;
    saveCallback(layout);
    return layout.overlayVisible;
  }

  /**
   * Set custom position for a badge
   */
  function setBadgePosition(badgeKey, x, y) {
    if (!schema.BADGE_KEYS.includes(badgeKey)) return;

    layout.positions[badgeKey] = { x, y };
    saveCallback(layout);
  }

  /**
   * Get custom position for a badge
   */
  function getBadgePosition(badgeKey) {
    return layout.positions[badgeKey] || null;
  }

  /**
   * Clear custom position for a badge (use default grid)
   */
  function clearBadgePosition(badgeKey) {
    delete layout.positions[badgeKey];
    saveCallback(layout);
  }

  /**
   * Get visible badges in order
   */
  function getVisibleBadges() {
    return layout.order.filter(key => layout.visibility[key] !== false);
  }

  /**
   * Get hidden badges
   */
  function getHiddenBadges() {
    return layout.order.filter(key => layout.visibility[key] === false);
  }

  return {
    setSaveCallback,
    getLayout,
    setLayout,
    resetLayout,
    getOrder,
    setOrder,
    moveBadge,
    getVisibility,
    setBadgeVisibility,
    setAllVisibility,
    setRows,
    getRows,
    toggleBadgeVisibility,
    isBadgeVisible,
    isOverlayVisible,
    setOverlayVisible,
    toggleOverlay,
    setBadgePosition,
    getBadgePosition,
    clearBadgePosition,
    getVisibleBadges,
    getHiddenBadges,
    setScale,
    getScale
  };
}

/**
 * HTML5 Drag&Drop helper for overlay badges
 * Attaches event handlers to a container with draggable badge elements.
 *
 * @param {HTMLElement} container - Container element with badge children
 * @param {function} onReorder - Callback with new order array when drag ends
 */
function setupDragDrop(container, onReorder) {
  let draggedItem = null;
  let draggedIndex = -1;

  function getBadges() {
    return Array.from(container.querySelectorAll('[data-badge-key]'));
  }

  function getIndex(element) {
    return getBadges().indexOf(element);
  }

  function handleDragStart(e) {
    draggedItem = e.target.closest('[data-badge-key]');
    if (!draggedItem) return;

    draggedIndex = getIndex(draggedItem);
    draggedItem.classList.add('dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItem.dataset.badgeKey);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetItem = e.target.closest('[data-badge-key]');
    if (!targetItem || targetItem === draggedItem) return;

    const targetIndex = getIndex(targetItem);
    const rect = targetItem.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // Determine if we should insert before or after
    if (e.clientY < midY) {
      container.insertBefore(draggedItem, targetItem);
    } else {
      container.insertBefore(draggedItem, targetItem.nextSibling);
    }
  }

  function handleDragEnd(e) {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }

    const newOrder = getBadges().map(el => el.dataset.badgeKey);
    if (onReorder) {
      onReorder(newOrder);
    }

    draggedItem = null;
    draggedIndex = -1;
  }

  function handleDrop(e) {
    e.preventDefault();
  }

  // Attach events
  container.addEventListener('dragstart', handleDragStart);
  container.addEventListener('dragover', handleDragOver);
  container.addEventListener('dragend', handleDragEnd);
  container.addEventListener('drop', handleDrop);

  // Return cleanup function
  return function cleanup() {
    container.removeEventListener('dragstart', handleDragStart);
    container.removeEventListener('dragover', handleDragOver);
    container.removeEventListener('dragend', handleDragEnd);
    container.removeEventListener('drop', handleDrop);
  };
}

// Export for Node.js (main process) and browser (UI)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createLayoutManager,
    setupDragDrop
  };
}
