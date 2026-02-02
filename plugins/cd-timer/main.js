/**
 * CD-Timer Plugin
 * Cooldown timers with hotkeys and overlay icons.
 */

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { pathToFileURL, fileURLToPath } = require("url");
const { app, globalShortcut, ipcMain, BrowserWindow } = require("electron");
const { spawn } = require("child_process");

const STORAGE_KEYS = {
  BADGES: "badges",
  OVERLAY: "overlay-settings",
  COLLAPSE: "panel-collapse",
};

const LEGACY_ROI_KEY = "overlay-roi";
const DEFAULT_OVERLAY = { x: 0.75, y: 0.05, columns: 5, hidden: false, iconSize: 52 };
const DEFAULT_BADGE_DURATION = 60_000;

let ctx = null;
let badges = [];
let overlay = { ...DEFAULT_OVERLAY };
let started = false;
let hotkeysPaused = false;
let focusPaused = false;
let collapseState = {};

const activeTimers = new Map(); // badgeId -> { startedAt, durationMs, remainingMs, interval }
const expiredTimers = new Map(); // badgeId -> { badge, expiredAt }
const hotkeyByBadge = new Map(); // badgeId -> accelerator
const hotkeyGroups = new Map(); // accelerator -> Set<badgeId>
const iconCache = new Map(); // absPath -> { url, dataUrl }

const ICON_MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

const VK_MODS = {
  CONTROL: 0x11,
  CTRL: 0x11,
  CMDORCTRL: 0x11,
  CMD: 0x11,
  ALT: 0x12,
  OPTION: 0x12,
  SHIFT: 0x10,
  SUPER: 0x5b,
  WIN: 0x5b,
  META: 0x5b,
};

function log(...args) {
  if (ctx?.logger?.info) {
    ctx.logger.info("[cd-timer]", ...args);
  } else {
    console.log("[cd-timer]", ...args);
  }
}

function warn(...args) {
  if (ctx?.logger?.warn) {
    ctx.logger.warn("[cd-timer]", ...args);
  } else {
    console.warn("[cd-timer]", ...args);
  }
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function clampOverlay(data) {
  const cfg = typeof data === "object" && data ? data : {};
  return {
    x: clamp01(cfg.x, DEFAULT_OVERLAY.x),
    y: clamp01(cfg.y, DEFAULT_OVERLAY.y),
    columns: clampInt(cfg.columns, 1, 12, DEFAULT_OVERLAY.columns),
    hidden: !!cfg.hidden,
    iconSize: clampInt(cfg.iconSize, 24, 96, DEFAULT_OVERLAY.iconSize),
  };
}

function overlayFromLegacyRoi(data) {
  if (!data || typeof data !== "object") return { ...DEFAULT_OVERLAY };
  return clampOverlay({
    x: clamp01(data.x ?? data.left, DEFAULT_OVERLAY.x),
    y: clamp01(data.y ?? data.top, DEFAULT_OVERLAY.y),
  });
}

function normalizeBadges(list) {
  const normalized = Array.isArray(list) ? [...list] : [];
  normalized.forEach((b, idx) => {
    b.id = typeof b.id === "string" && b.id ? b.id : `badge-${Date.now()}-${idx}`;
    b.enabled = b.enabled !== false;
    b.name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "Timer";
    b.iconPath = typeof b.iconPath === "string" && b.iconPath.trim() ? b.iconPath.trim() : null;
    b.durationMs = Number.isFinite(b.durationMs) && b.durationMs > 0 ? b.durationMs : DEFAULT_BADGE_DURATION;
    b.hotkey = typeof b.hotkey === "string" && b.hotkey.trim() ? b.hotkey.trim() : null;
    b.target = b.target === "support" ? "support" : "main";
    b.position = Number.isFinite(b.position) ? b.position : idx;
  });
  normalized.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  normalized.forEach((b, idx) => {
    b.position = idx;
  });
  return normalized;
}

async function loadState() {
  try {
    const storedBadges = await ctx.services.storage.read(STORAGE_KEYS.BADGES);
    badges = normalizeBadges(storedBadges);
  } catch (err) {
    warn("Failed to load badges, using defaults", err?.message || err);
    badges = normalizeBadges([]);
  }

  try {
    const storedOverlay = await ctx.services.storage.read(STORAGE_KEYS.OVERLAY);
    overlay = clampOverlay(storedOverlay);
  } catch (_err) {
    overlay = { ...DEFAULT_OVERLAY };
    // Soft-migrate legacy ROI position into overlay placement
    try {
      const legacyRoi = await ctx.services.storage.read(LEGACY_ROI_KEY);
      overlay = overlayFromLegacyRoi(legacyRoi);
      await saveOverlay();
    } catch (_err2) {
      /* ignore legacy migration failures */
    }
  }

  try {
    const storedCollapse = await ctx.services.storage.read(STORAGE_KEYS.COLLAPSE);
    collapseState = typeof storedCollapse === "object" && storedCollapse ? storedCollapse : {};
  } catch (_err) {
    collapseState = {};
  }
}

async function saveBadges() {
  await ctx.services.storage.write(STORAGE_KEYS.BADGES, badges);
}

async function saveOverlay() {
  overlay = clampOverlay(overlay);
  await ctx.services.storage.write(STORAGE_KEYS.OVERLAY, overlay);
}

async function saveCollapseState() {
  const safe = typeof collapseState === "object" && collapseState ? collapseState : {};
  await ctx.services.storage.write(STORAGE_KEYS.COLLAPSE, safe);
}

function getBadge(id) {
  return badges.find((b) => b.id === id) || null;
}

function unregisterHotkey(badgeId) {
  const accelerator = hotkeyByBadge.get(badgeId);
  if (!accelerator) return;

  hotkeyByBadge.delete(badgeId);
  const group = hotkeyGroups.get(accelerator);
  if (group) {
    group.delete(badgeId);
    if (group.size === 0) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (err) {
        warn("Failed to unregister hotkey", accelerator, err?.message || err);
      }
      hotkeyGroups.delete(accelerator);
    }
  } else {
    try {
      globalShortcut.unregister(accelerator);
    } catch (err) {
      warn("Failed to unregister hotkey", accelerator, err?.message || err);
    }
  }
}

function acceleratorToVkParts(accelerator) {
  if (!accelerator || typeof accelerator !== "string") return null;
  const parts = accelerator.split("+").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const keyPart = parts.pop();

  const mods = [];
  for (const mod of parts) {
    const upper = mod.toUpperCase();
    if (VK_MODS[upper]) {
      mods.push(VK_MODS[upper]);
    }
  }

  const key = (keyPart || "").toUpperCase();
  const mapKey = () => {
    if (key.length === 1) {
      const code = key.charCodeAt(0);
      if (code >= 48 && code <= 57) return code; // 0-9
      if (code >= 65 && code <= 90) return code; // A-Z
    }
    const fnMatch = key.match(/^F(\d{1,2})$/);
    if (fnMatch) {
      const n = Number(fnMatch[1]);
      if (n >= 1 && n <= 24) return 0x70 + (n - 1);
    }
    const specials = {
      "SPACE": 0x20,
      "TAB": 0x09,
      "ENTER": 0x0d,
      "RETURN": 0x0d,
      "ESC": 0x1b,
      "ESCAPE": 0x1b,
      "UP": 0x26,
      "DOWN": 0x28,
      "LEFT": 0x25,
      "RIGHT": 0x27,
      "HOME": 0x24,
      "END": 0x23,
      "PAGEUP": 0x21,
      "PAGEDOWN": 0x22,
      "BACKSPACE": 0x08,
      "DELETE": 0x2e,
      "INSERT": 0x2d,
    };
    if (specials[key]) return specials[key];
    return null;
  };

  const keyVk = mapKey();
  if (!keyVk) return null;
  return { mods, keyVk };
}

// Map accelerator key names to Electron keyCode format
function acceleratorToKeyCode(accelerator) {
  if (!accelerator || typeof accelerator !== "string") return null;
  const parts = accelerator.split("+").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  const keyPart = parts.pop();
  const modifiers = [];

  for (const mod of parts) {
    const upper = mod.toUpperCase();
    if (upper === "CONTROL" || upper === "CTRL" || upper === "CMDORCTRL" || upper === "CMD") {
      modifiers.push("control");
    } else if (upper === "ALT" || upper === "OPTION") {
      modifiers.push("alt");
    } else if (upper === "SHIFT") {
      modifiers.push("shift");
    } else if (upper === "SUPER" || upper === "WIN" || upper === "META") {
      modifiers.push("meta");
    }
  }

  // Convert key to lowercase for Electron's sendInputEvent
  let keyCode = (keyPart || "").toLowerCase();

  // Handle special keys
  const specialMap = {
    "space": " ",
    "enter": "Return",
    "return": "Return",
    "esc": "Escape",
    "escape": "Escape",
    "tab": "Tab",
    "backspace": "Backspace",
    "delete": "Delete",
    "insert": "Insert",
    "home": "Home",
    "end": "End",
    "pageup": "PageUp",
    "pagedown": "PageDown",
    "up": "Up",
    "down": "Down",
    "left": "Left",
    "right": "Right",
  };

  if (specialMap[keyCode]) {
    keyCode = specialMap[keyCode];
  } else if (/^f\d{1,2}$/i.test(keyCode)) {
    // F1-F24
    keyCode = keyCode.toUpperCase();
  }

  return { keyCode, modifiers };
}

// Get the profile ID of the currently active/focused game view
async function getActiveProfileId() {
  try {
    const mainProfileId = ctx?.services?.profiles ? await ctx.services.profiles.getOverlayTargetId() : null;
    const supportProfileId = ctx?.services?.profiles ? await ctx.services.profiles.getOverlaySupportTargetId() : null;
    const sessionTabs = ctx?.services?.sessionTabs;

    // Try to detect which BrowserView is actually focused
    const focusedWin = BrowserWindow.getFocusedWindow();
    if (focusedWin && sessionTabs?.getViewByProfile) {
      const focusedView = focusedWin
        .getBrowserViews()
        .find((view) => view?.webContents?.isFocused?.());
      if (focusedView) {
        const supportView = supportProfileId ? sessionTabs.getViewByProfile(supportProfileId) : null;
        const mainView = mainProfileId ? sessionTabs.getViewByProfile(mainProfileId) : null;
        if (supportView && focusedView === supportView) {
          return { profileId: supportProfileId, target: "support" };
        }
        if (mainView && focusedView === mainView) {
          return { profileId: mainProfileId, target: "main" };
        }
      }
    }

    // Fall back to the active tab ID from sessionTabs
    const activeId = sessionTabs?.getActiveId?.();
    log("getActiveProfileId: activeId=", activeId, "mainId=", mainProfileId, "supportId=", supportProfileId);

    if (activeId) {
      if (activeId === supportProfileId) {
        return { profileId: supportProfileId, target: "support" };
      }
      if (activeId === mainProfileId) {
        return { profileId: mainProfileId, target: "main" };
      }
    }

    // Fallback: return main if we can't determine
    return mainProfileId ? { profileId: mainProfileId, target: "main" } : null;
  } catch (err) {
    warn("getActiveProfileId failed", err?.message || err);
    return null;
  }
}

// Send key event to the currently ACTIVE/FOCUSED BrowserView (not the configured target)
async function sendKeyToActiveWebContents(accelerator) {
  const keyInfo = acceleratorToKeyCode(accelerator);
  if (!keyInfo) return false;

  try {
    let targetWebContents = null;

    // Prefer the actually focused BrowserView if any
    const focusedWin = BrowserWindow.getFocusedWindow();
    if (focusedWin) {
      const focusedView = focusedWin.getBrowserViews().find((view) => view?.webContents?.isFocused?.());
      if (focusedView && focusedView.webContents && !focusedView.webContents.isDestroyed()) {
        targetWebContents = focusedView.webContents;
        log("Sending key to focused view");
      }
    }

    // Get the active profile ID and its view
    const activeId = ctx?.services?.sessionTabs?.getActiveId?.();
    if (!targetWebContents && activeId && ctx?.services?.sessionTabs) {
      const activeView = ctx.services.sessionTabs.getViewByProfile(activeId);
      if (activeView && activeView.webContents && !activeView.webContents.isDestroyed()) {
        targetWebContents = activeView.webContents;
        log("Sending key to active profile:", activeId);
      }
    }

    // Fallback: try focused window
    if (!targetWebContents && focusedWin && !focusedWin.isDestroyed()) {
      const views = focusedWin.getBrowserViews();
      for (const view of views) {
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          const bounds = view.getBounds();
          if (bounds.width > 0 && bounds.height > 0) {
            targetWebContents = view.webContents;
            log("Fallback: using first visible BrowserView");
            break;
          }
        }
      }
      if (!targetWebContents) {
        targetWebContents = focusedWin.webContents;
        log("Fallback: using main window webContents");
      }
    }

    if (!targetWebContents || targetWebContents.isDestroyed()) {
      log("No valid webContents for key passthrough");
      return false;
    }

    // Send keyDown event
    targetWebContents.sendInputEvent({
      type: "keyDown",
      keyCode: keyInfo.keyCode,
      modifiers: keyInfo.modifiers,
    });

    // Send char event for printable characters
    if (keyInfo.keyCode.length === 1) {
      targetWebContents.sendInputEvent({
        type: "char",
        keyCode: keyInfo.keyCode,
        modifiers: keyInfo.modifiers,
      });
    }

    // Send keyUp event
    targetWebContents.sendInputEvent({
      type: "keyUp",
      keyCode: keyInfo.keyCode,
      modifiers: keyInfo.modifiers,
    });

    return true;
  } catch (err) {
    warn("sendKeyToActiveWebContents failed", accelerator, err?.message || err);
    return false;
  }
}

function sendHotkeyPassthrough(accelerator) {
  return new Promise((resolve) => {
    sendKeyToActiveWebContents(accelerator)
      .then((success) => {
        if (!success) {
          log("Electron passthrough failed, key may not reach the game");
        }
        resolve();
      })
      .catch((err) => {
        warn("Hotkey passthrough failed", accelerator, err?.message || err);
        resolve();
      });
  });
}

function suspendHotkeys() {
  if (hotkeysPaused) return;
  hotkeysPaused = true;
  for (const accelerator of Array.from(hotkeyGroups.keys())) {
    try {
      globalShortcut.unregister(accelerator);
    } catch (err) {
      warn("Failed to unregister hotkey during suspend", accelerator, err?.message || err);
    }
  }
  hotkeyGroups.clear();
  hotkeyByBadge.clear();
}

function resumeHotkeys() {
  if (!hotkeysPaused) return;
  hotkeysPaused = false;
  if (!focusPaused) {
    refreshHotkeys();
  }
}

// Suspend global shortcuts when a child window (e.g. side panel) gains focus,
// so keystrokes reach the focused window instead of being swallowed.
function onBrowserWindowFocus(_event, win) {
  if (!started || !win || win.isDestroyed()) return;
  const isChildWindow = !!win.getParentWindow();
  if (isChildWindow && !focusPaused) {
    focusPaused = true;
    // Unregister all global shortcuts so keys pass through to the child window
    for (const accelerator of Array.from(hotkeyGroups.keys())) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (err) {
        warn("Failed to unregister hotkey during focus suspend", accelerator, err?.message || err);
      }
    }
    hotkeyGroups.clear();
    hotkeyByBadge.clear();
    log("Hotkeys suspended (child window focused)");
  } else if (!isChildWindow && focusPaused) {
    focusPaused = false;
    if (!hotkeysPaused) {
      refreshHotkeys();
    }
    log("Hotkeys resumed (main window focused)");
  }
}

async function handleHotkeyPress(accelerator) {
  void sendHotkeyPassthrough(accelerator);

  const active = await getActiveProfileId();
  const activeTarget = active?.target || null;

  // Collect all badges that use this accelerator
  const candidates = badges
    .filter((b) => b.enabled !== false && b.hotkey === accelerator)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (!candidates.length) {
    log("Hotkey pressed but no badges configured for", accelerator);
    return;
  }

  // Build target preference: active target first (if known), then main, then support
  const targetPreference = [];
  if (activeTarget) targetPreference.push(activeTarget);
  targetPreference.push("main", "support");

  let chosen = null;
  for (const target of targetPreference) {
    const match = candidates.find((b) => (b.target || "main") === target);
    if (match) {
      chosen = { badge: match, target };
      break;
    }
  }

  if (!chosen) {
    // Fallback to the first candidate if targets somehow don't match
    chosen = { badge: candidates[0], target: candidates[0].target || "main" };
  }

  startTimer(chosen.badge.id, { target: chosen.target, accelerator });
}

function registerHotkey(badge) {
  unregisterHotkey(badge.id);
  if (!started || hotkeysPaused || focusPaused || !badge.enabled || !badge.hotkey) return;

  const accelerator = badge.hotkey;
  let group = hotkeyGroups.get(accelerator);

  if (!group) {
    // Register accelerator once so multiple badges (e.g., main + support) can share it
    group = new Set();
    hotkeyGroups.set(accelerator, group);
    try {
      globalShortcut.register(accelerator, () => {
        void handleHotkeyPress(accelerator);
      });
    } catch (err) {
      hotkeyGroups.delete(accelerator);
      warn("Hotkey registration threw", accelerator, err?.message || err);
      return;
    }
    if (!globalShortcut.isRegistered(accelerator)) {
      hotkeyGroups.delete(accelerator);
      warn("Hotkey registration failed", accelerator, "for badge", badge.id);
      return;
    }
  }

  group.add(badge.id);
  hotkeyByBadge.set(badge.id, accelerator);
}

function refreshHotkeys() {
  if (hotkeysPaused || focusPaused) return;
  for (const accelerator of Array.from(hotkeyGroups.keys())) {
    try {
      globalShortcut.unregister(accelerator);
    } catch (err) {
      warn("Failed to unregister hotkey", accelerator, err?.message || err);
    }
  }
  hotkeyGroups.clear();
  hotkeyByBadge.clear();
  badges.forEach(registerHotkey);
}

function stopTimer(badgeId, opts = { clearExpired: true }) {
  const state = activeTimers.get(badgeId);
  if (state?.interval) {
    clearInterval(state.interval);
  }
  activeTimers.delete(badgeId);
  if (opts?.clearExpired) {
    expiredTimers.delete(badgeId);
  }
}

function broadcast(channel, payload) {
  try {
    ctx.ipc.broadcast(channel, payload);
  } catch (_err) {
    // UI iframes cannot receive broadcasts; ignore errors
  }
}

function markExpired(badge) {
  stopTimer(badge.id, { clearExpired: false });
  expiredTimers.set(badge.id, { badge: { ...badge }, expiredAt: Date.now() });
  broadcast("timer:expired", { badgeId: badge.id, badge });
}

function startTimer(badgeId, meta = {}) {
  const badge = getBadge(badgeId);
  if (!badge || !badge.enabled) {
    return { success: false, error: "Badge not found or disabled" };
  }

  stopTimer(badgeId, { clearExpired: true });

  const state = {
    startedAt: Date.now(),
    durationMs: badge.durationMs,
    remainingMs: badge.durationMs,
    interval: null,
  };

  state.interval = setInterval(() => {
    const remaining = Math.max(0, badge.durationMs - (Date.now() - state.startedAt));
    state.remainingMs = remaining;
    broadcast("timer:tick", { badgeId, remaining, target: badge.target || "main" });
    if (remaining <= 0) {
      markExpired(badge);
    }
  }, 100);

  activeTimers.set(badgeId, state);
  broadcast("timer:start", { badgeId, durationMs: badge.durationMs, target: badge.target || "main", meta });
  return { success: true };
}

function timerSnapshot() {
  const active = {};
  for (const [badgeId, state] of activeTimers.entries()) {
    active[badgeId] = {
      remainingMs: state.remainingMs,
      durationMs: state.durationMs,
      startedAt: state.startedAt,
    };
  }
  const expired = {};
  for (const [badgeId, meta] of expiredTimers.entries()) {
    expired[badgeId] = { expiredAt: meta.expiredAt };
  }
  return { active, expired };
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  return ICON_MIME_BY_EXT[ext] || "image/png";
}

function resolveIconPath(iconPath) {
  if (!iconPath) return { existing: null, target: null, filePath: null };
  const raw = String(iconPath);
  if (raw.startsWith("file://")) {
    let filePath = null;
    try {
      filePath = fileURLToPath(raw);
    } catch (_err) {
      filePath = null;
    }
    const exists = filePath && fsSync.existsSync(filePath) ? filePath : null;
    return { existing: exists, target: raw, filePath };
  }

  const userData = app.getPath("userData");
  const normalized = raw.replace(/^[/\\\\]+/, "");
  const candidates = path.isAbsolute(raw)
    ? [raw]
    : [
        path.join(userData, normalized), // api_fetch or other data relative to userData
        path.join(userData, "icons", normalized), // legacy icons folder
      ];

  const existing = candidates.find((p) => {
    try {
      return fsSync.existsSync(p);
    } catch (_err) {
      return false;
    }
  });

  const target = existing || candidates[0] || null;
  return { existing, target, filePath: existing };
}

async function resolveIconSources(iconPath, { forceReload = false } = {}) {
  const { existing, target, filePath } = resolveIconPath(iconPath);
  if (!target) return { url: null, dataUrl: null };

  const cacheKey = target;
  if (!forceReload && iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  let url = null;
  try {
    url = target.startsWith("file://") ? target : pathToFileURL(target).href;
  } catch (_err) {
    url = null;
  }

  let dataUrl = null;
  const loadPath = existing || filePath || null;
  if (loadPath) {
    try {
      const buffer = await fs.readFile(loadPath);
      const mime = guessMimeType(loadPath);
      dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    } catch (_err) {
      dataUrl = null;
    }
  }

  const entry = { url, dataUrl };
  iconCache.set(cacheKey, entry);
  return entry;
}

async function overlayState() {
  const expired = [];
  for (const { badge, expiredAt } of expiredTimers.values()) {
    const icon = await resolveIconSources(badge.iconPath);
    expired.push({
      badgeId: badge.id,
      name: badge.name,
      iconPath: badge.iconPath,
      iconUrl: icon.url,
      iconDataUrl: icon.dataUrl,
      expiredAt,
    });
  }
  return { overlay, expired };
}

async function serializeBadge(badge) {
  const icon = await resolveIconSources(badge.iconPath);
  return {
    ...badge,
    iconUrl: icon.url,
    iconDataUrl: icon.dataUrl,
    collapsed: !!collapseState[badge.id],
  };
}

async function serializeBadges() {
  return Promise.all(badges.map((badge) => serializeBadge(badge)));
}

async function createBadge(payload = {}) {
  const badge = {
    id: `badge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    enabled: true,
    name: "Timer",
    iconPath: null,
    durationMs: DEFAULT_BADGE_DURATION,
    hotkey: null,
    position: badges.length,
    ...payload,
  };
  badges.push(badge);
  badges = normalizeBadges(badges);
  await saveBadges();
  registerHotkey(badge);
  return badge;
}

async function updateBadge(id, updates) {
  const badge = getBadge(id);
  if (!badge) {
    throw new Error("Badge not found");
  }
  if (updates.name !== undefined) {
    badge.name = String(updates.name || "").trim() || "Timer";
  }
  if (updates.enabled !== undefined) {
    badge.enabled = !!updates.enabled;
  }
  if (updates.iconPath !== undefined) {
    badge.iconPath = updates.iconPath ? String(updates.iconPath) : null;
  }
  if (updates.durationMs !== undefined) {
    const next = Number(updates.durationMs);
    if (Number.isFinite(next) && next > 0) {
      badge.durationMs = next;
      stopTimer(id, { clearExpired: true });
    }
  }
  if (updates.hotkey !== undefined) {
    badge.hotkey = updates.hotkey ? String(updates.hotkey) : null;
  }
  if (updates.target !== undefined) {
    badge.target = updates.target === "support" ? "support" : "main";
  }
  if (updates.position !== undefined && Number.isFinite(updates.position)) {
    badge.position = Number(updates.position);
    badges = normalizeBadges(badges);
  }

  badges = normalizeBadges(badges);
  await saveBadges();
  if (!badge.enabled) {
    stopTimer(id, { clearExpired: true });
  }
  registerHotkey(badge);
  return badge;
}

async function deleteBadge(id) {
  const idx = badges.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  const [removed] = badges.splice(idx, 1);
  stopTimer(id, { clearExpired: true });
  unregisterHotkey(id);
  expiredTimers.delete(id);
  badges = normalizeBadges(badges);
  await saveBadges();
  return removed;
}

async function setAllEnabled(enabled) {
  let changed = 0;
  badges.forEach((badge) => {
    if (badge.enabled !== enabled) {
      badge.enabled = enabled;
      changed += 1;
      if (!enabled) {
        stopTimer(badge.id, { clearExpired: true });
      }
    }
    registerHotkey(badge);
  });
  if (changed > 0) {
    badges = normalizeBadges(badges);
    await saveBadges();
  }
  return changed;
}

async function loadBuffIconListFromApiFetch() {
  const baseDir = path.join(app.getPath("userData"), "api_fetch", "item");
  const mappedPath = path.join(baseDir, "buff_icon_buffname.json");
  const sourcePath = path.join(baseDir, "item_parameter.json");

  const normalizeName = (name) => {
    if (!name) return "";
    if (typeof name === "string") return name;
    if (typeof name === "object") {
      return name.en || Object.values(name)[0] || "";
    }
    return String(name);
  };

  try {
    const raw = await fs.readFile(mappedPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          iconname: item.iconname || item.icon || item.iconName,
          buffname: item.buffname || normalizeName(item.name),
        }))
        .filter((item) => item.iconname && item.buffname);
    }
  } catch (_err) {
    // Fallback to live parsing of item_parameter.json
  }

  try {
    const raw = await fs.readFile(sourcePath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const buffs = data
      .filter((item) => item?.category === "buff" && item.icon)
      .map((item) => ({
        iconname: item.icon,
        buffname: normalizeName(item.name),
      }))
      .filter((item) => item.iconname && item.buffname);

    try {
      await fs.writeFile(mappedPath, JSON.stringify(buffs, null, 2), "utf8");
    } catch (err) {
      warn("Could not cache buff_icon_buffname.json", err?.message || err);
    }
    return buffs;
  } catch (err) {
    warn("Failed to build buff icon list from api_fetch", err?.message || err);
    return [];
  }
}

async function listApiFetchIcons() {
  const buffs = await loadBuffIconListFromApiFetch();
  if (!buffs.length) return [];
  const userData = app.getPath("userData");
  const seen = new Set();
  const icons = [];
  for (const item of buffs) {
    const iconFile = item.iconname;
    const name = item.buffname || "";
    if (!iconFile || !name) continue;
    const relPath = path.join("api_fetch", "item", "icons", iconFile).replace(/\\/g, "/");
    const absPath = path.join(userData, relPath);
    if (!fsSync.existsSync(absPath)) continue;
    if (seen.has(relPath)) continue;
    seen.add(relPath);
    icons.push({
      id: `api:${relPath}`,
      category: "items",
      name,
      path: relPath,
    });
  }
  return icons;
}

async function listSkillIcons() {
  const userData = app.getPath("userData");
  const root = path.join(userData, "api_fetch", "skill");
  const mappingPath = path.join(root, "skill_icon_skillname.json");

  let entries = [];
  try {
    const raw = await fs.readFile(mappingPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed;
    }
  } catch (_err) {
    return [];
  }

  const icons = [];
  for (const entry of entries) {
    const iconFile = entry?.iconname || entry?.icon || null;
    const name = entry?.skillname || entry?.name || iconFile || "";
    if (!iconFile || !name) continue;

    const relCandidates = [
      path.join("api_fetch", "skill", "icons", "colored", iconFile).replace(/\\/g, "/"),
      path.join("api_fetch", "skill", "icons", "old", iconFile).replace(/\\/g, "/"),
    ];

    let relPath = relCandidates[0];
    for (const candidate of relCandidates) {
      const abs = path.join(userData, candidate);
      if (fsSync.existsSync(abs)) {
        relPath = candidate;
        break;
      }
    }

    icons.push({
      id: `skill:${relPath}`,
      category: "skills",
      name,
      path: relPath,
    });
  }

  return icons;
}

async function listLegacyIcons() {
  const root = path.join(app.getPath("userData"), "icons");
  const categories = ["buffs", "items", "skills"];
  const icons = [];

  for (const category of categories) {
    const dir = path.join(root, category);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (![".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(ext)) continue;
        const relPath = path.join(category, entry.name).replace(/\\/g, "/");
        const displayName = entry.name.replace(ext, "");
        icons.push({
          id: `legacy:${relPath}`,
          category,
          name: displayName,
          path: relPath,
        });
      }
    } catch (_err) {
      // Ignore missing category
    }
  }

  return icons;
}

async function listIcons() {
  const [apiIcons, legacyIcons, skillIcons] = await Promise.all([
    listApiFetchIcons(),
    listLegacyIcons(),
    listSkillIcons(),
  ]);

  const icons = [...apiIcons, ...legacyIcons, ...skillIcons];
  icons.sort((a, b) => {
    const nameA = (a.name || a.path || "").toLowerCase();
    const nameB = (b.name || b.path || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const withSources = await Promise.all(
    icons.map(async (icon) => {
      const meta = await resolveIconSources(icon.path, { forceReload: true });
      return { ...icon, url: meta.url, dataUrl: meta.dataUrl };
    })
  );

  return { root: app.getPath("userData"), icons: withSources };
}

function registerIpcHandlers() {
  ctx.ipc.handle("badge:list", async () => {
    return { badges: await serializeBadges(), timers: timerSnapshot(), overlay };
  });

  ctx.ipc.handle("badge:expireall", async () => {
    const now = Date.now();
    expiredTimers.clear();
    for (const badge of badges) {
      if (!badge.enabled) continue;
      stopTimer(badge.id, { clearExpired: true });
      expiredTimers.set(badge.id, { badge: { ...badge }, expiredAt: now });
      broadcast("timer:expired", { badgeId: badge.id, badge });
    }
    await saveBadges();
    return { badges: await serializeBadges(), timers: timerSnapshot() };
  });

  ctx.ipc.handle("badge:create", async (_event, payload) => {
    const badge = await createBadge(payload);
    return { badge: await serializeBadge(badge), badges: await serializeBadges(), timers: timerSnapshot() };
  });

  ctx.ipc.handle("badge:update", async (_event, id, updates) => {
    const badge = await updateBadge(id, updates || {});
    return { badge: await serializeBadge(badge), badges: await serializeBadges(), timers: timerSnapshot() };
  });

  ctx.ipc.handle("badge:delete", async (_event, id) => {
    const removed = await deleteBadge(id);
    return { success: !!removed, badges: await serializeBadges(), timers: timerSnapshot() };
  });

  ctx.ipc.handle("badge:enableall", async (_event, enabled) => {
    await setAllEnabled(!!enabled);
    return { badges: await serializeBadges(), timers: timerSnapshot() };
  });

  ctx.ipc.handle("timer:start", async (_event, id) => {
    return startTimer(id);
  });

  ctx.ipc.handle("timer:state", async () => {
    return timerSnapshot();
  });

  ctx.ipc.handle("overlay:state", async () => {
    return overlayState();
  });

  ctx.ipc.handle("overlay:update", async (_event, updates) => {
    const next = (updates && typeof updates === "object") ? updates : {};
    overlay = next.reset ? { ...DEFAULT_OVERLAY } : { ...overlay };
    overlay = clampOverlay({ ...overlay, ...next });
    await saveOverlay();
    return overlay;
  });

  ctx.ipc.handle("icons:list", async () => {
    return listIcons();
  });

  ctx.ipc.handle("hotkeys:pause", async () => {
    suspendHotkeys();
    return true;
  });

  ctx.ipc.handle("hotkeys:resume", async () => {
    resumeHotkeys();
    return true;
  });

  ctx.ipc.handle("collapse:set", async (_event, badgeId, collapsed) => {
    if (typeof badgeId !== "string") return { success: false };
    collapseState[badgeId] = !!collapsed;
    await saveCollapseState();
    return { success: true };
  });
}

async function init(context) {
  ctx = context;
  await loadState();
  registerIpcHandlers();
  log("CD-Timer initialized with", badges.length, "badges");
}

async function start() {
  started = true;
  focusPaused = false;
  refreshHotkeys();
  app.on("browser-window-focus", onBrowserWindowFocus);
  log("CD-Timer started");
}

async function stop() {
  started = false;
  app.removeListener("browser-window-focus", onBrowserWindowFocus);
  focusPaused = false;
  for (const timerId of Array.from(activeTimers.keys())) {
    stopTimer(timerId, { clearExpired: false });
  }
  suspendHotkeys();
  activeTimers.clear();
  expiredTimers.clear();
  log("CD-Timer stopped");
}

module.exports = {
  init,
  start,
  stop,
};
