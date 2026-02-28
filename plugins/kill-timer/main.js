/**
 * Kill Timer Plugin
 * Tracks time-to-kill per enemy by subscribing to OCR updates.
 * Alerts when enemy HP drops below a configurable threshold.
 */

const STORAGE_KEY = "kill-timer-settings";
const DEFAULT_SETTINGS = { threshold: 20, x: 0.5, y: 0.05, enabled: true };

let ctx = null;
let settings = { ...DEFAULT_SETTINGS };
let unsubscribeOcr = null;

// Map<profileId, { startedAt: number|null, lastCurrentHp: number|null,
//                  lastMaxHp: number|null, lastEnemyName: string|null }>
const killTimerStates = new Map();

function log(...args) {
  if (ctx?.logger?.info) ctx.logger.info("[kill-timer]", ...args);
  else console.log("[kill-timer]", ...args);
}

function warn(...args) {
  if (ctx?.logger?.warn) ctx.logger.warn("[kill-timer]", ...args);
  else console.warn("[kill-timer]", ...args);
}

function defaultState() {
  return { startedAt: null, lastCurrentHp: null, lastMaxHp: null, lastEnemyName: null };
}

function getProfileState(profileId) {
  if (!killTimerStates.has(profileId)) {
    killTimerStates.set(profileId, defaultState());
  }
  return killTimerStates.get(profileId);
}

function parseHp(value) {
  if (!value || typeof value !== "string") return [null, null];
  const match = value.match(/(\d[\d.,]*)\s*[\/|]\s*(\d[\d.,]*)/);
  if (!match) return [null, null];
  const current = parseInt(match[1].replace(/[.,]/g, ""), 10);
  const max = parseInt(match[2].replace(/[.,]/g, ""), 10);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return [null, null];
  return [current, max];
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeSettings(data) {
  const d = typeof data === "object" && data ? data : {};
  return {
    threshold: clampInt(d.threshold, 5, 50, DEFAULT_SETTINGS.threshold),
    x: clamp01(d.x, DEFAULT_SETTINGS.x),
    y: clamp01(d.y, DEFAULT_SETTINGS.y),
    enabled: d.enabled !== false,
  };
}

async function loadSettings() {
  try {
    const stored = await ctx.services.storage.read(STORAGE_KEY);
    settings = normalizeSettings(stored);
  } catch (_err) {
    settings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings() {
  try {
    await ctx.services.storage.write(STORAGE_KEY, settings);
  } catch (err) {
    warn("Failed to save settings", err?.message || err);
  }
}

function handleOcrUpdate(data) {
  const { profileId, key, value } = data || {};
  if (!profileId || !key) return;

  const state = getProfileState(profileId);

  if (key === "enemyName") {
    const newName = (value && typeof value === "string" && value.trim()) ? value.trim() : null;
    if (newName !== state.lastEnemyName) {
      // Target changed – reset timer, keep tracking new target
      state.startedAt = null;
      state.lastCurrentHp = null;
      state.lastMaxHp = null;
      state.lastEnemyName = newName;
    }
  } else if (key === "enemyHp") {
    const [current, max] = parseHp(value);
    if (current !== null && max !== null) {
      if (state.lastCurrentHp !== null) {
        if (current < state.lastCurrentHp && state.startedAt === null) {
          // First HP loss detected → start timer
          state.startedAt = Date.now();
          log(`Timer started for profile ${profileId} (HP: ${current}/${max})`);
        } else if (current > state.lastCurrentHp * 1.1) {
          // HP jumped >10% upward → new mob of same type, reset timer
          state.startedAt = null;
          log(`Timer reset (HP jump) for profile ${profileId}: ${state.lastCurrentHp} → ${current}`);
        }
      }
      state.lastCurrentHp = current;
      state.lastMaxHp = max;
    }
  }
}

function registerIpcHandlers() {
  ctx.ipc.handle("state:get", (_event, profileId) => {
    if (!profileId) return null;
    const state = getProfileState(profileId);
    const now = Date.now();
    const elapsed = state.startedAt ? now - state.startedAt : 0;
    const hpPercent = (state.lastMaxHp > 0 && state.lastCurrentHp !== null)
      ? Math.round((state.lastCurrentHp / state.lastMaxHp) * 100)
      : null;
    return {
      running: state.startedAt !== null,
      startedAt: state.startedAt,
      elapsed,
      hpPercent,
      threshold: settings.threshold,
      hasTarget: state.lastEnemyName !== null,
      enabled: settings.enabled,
      x: settings.x,
      y: settings.y,
    };
  });

  ctx.ipc.handle("settings:get", () => {
    return { ...settings };
  });

  ctx.ipc.handle("settings:update", async (_event, updates) => {
    if (!updates || typeof updates !== "object") return { ...settings };
    settings = normalizeSettings({ ...settings, ...updates });
    await saveSettings();
    return { ...settings };
  });

  ctx.ipc.handle("timer:reset", (_event, profileId) => {
    if (profileId) {
      const state = getProfileState(profileId);
      state.startedAt = null;
      state.lastEnemyName = null;
      state.lastCurrentHp = null;
      state.lastMaxHp = null;
      log(`Timer manually reset for profile ${profileId}`);
    } else {
      // Reset all profiles
      for (const state of killTimerStates.values()) {
        state.startedAt = null;
        state.lastEnemyName = null;
        state.lastCurrentHp = null;
        state.lastMaxHp = null;
      }
      log("Timer manually reset for all profiles");
    }
    return { success: true };
  });
}

async function init(context) {
  ctx = context;
  await loadSettings();
  registerIpcHandlers();
  log("Kill-Timer initialized");
}

async function start() {
  unsubscribeOcr = ctx.eventBus.on("core:ocr:update", handleOcrUpdate);
  log("Kill-Timer started");
}

async function stop() {
  if (unsubscribeOcr) {
    unsubscribeOcr();
    unsubscribeOcr = null;
  }
  killTimerStates.clear();
  log("Kill-Timer stopped");
}

module.exports = { init, start, stop };
