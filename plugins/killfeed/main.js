/**
 * Killfeed Plugin - Main Entry Point
 * Lifecycle management, IPC handlers, and OCR event processing.
 */

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const crypto = require('crypto');
const schema = require('./shared/schema.js');
const { createStatsEngine } = require('./shared/stats_engine.js');
const { createLayoutManager } = require('./shared/layout.js');
const monsterExpValidator = require('./shared/monster_exp_validator.js');

// Plugin directory - set in init() from context.pluginDir
// IMPORTANT: __dirname is undefined because plugins are loaded via dynamic import()
let pluginDir = null;

// Debug configuration
let debugConfig = {
  enabled: false,
  ocr: false,
  lifecycle: false,
  ipc: false,
  discord: false
};

function loadDebugConfig() {
  if (!pluginDir) return;
  try {
    const configPath = path.join(pluginDir, 'debugConfig.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      debugConfig = { ...debugConfig, ...parsed };
    }
  } catch (err) {
    // Silently use defaults
  }
}

function debugLog(category, ...args) {
  if (!debugConfig.enabled) return;
  if (category && !debugConfig[category]) return;
  if (ctx?.logger?.info) {
    ctx.logger.info(...args);
  } else {
    console.log('[Killfeed]', ...args);
  }
}

const monsterReference = [];
const monsterDetailsCache = new Map(); // id -> parsed json

function loadMonsterReference() {
  if (monsterReference.length > 0) return;
  const candidates = [];
  if (pluginDir) {
    candidates.push(path.join(pluginDir, 'monster_reference.json'));
  }
  try { candidates.push(path.join(app.getPath('userData'), 'plugins', 'killfeed', 'monster_reference.json')); } catch (_) {}
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        monsterReference.length = 0;
        if (Array.isArray(data)) {
          data.forEach((row) => monsterReference.push(row));
        }
        console.log('[Killfeed][MonsterRef] geladen aus', p, '| Einträge:', monsterReference.length);
        return;
      }
    } catch (err) {
      console.log('[Killfeed][MonsterRef] Fehler bei', p, ':', err?.message || err);
    }
  }
  console.log('[Killfeed][MonsterRef] NICHT GEFUNDEN! candidates:', candidates);
}

// Plugin state
let config = null;
let ctx = null;

// Per-profile state
const profileEngines = new Map(); // profileId -> statsEngine
const profileLayouts = new Map(); // profileId -> layoutManager

// Window references
const overlayWindows = new Map(); // browserViewId -> windowHandle
const sidepanelWindow = null;
let giantTrackerWindow = null; // BrowserWindow | null

// Event unsubscribe functions
let unsubscribeOcr = null;

// Throttle state for broadcasts
const lastBroadcast = new Map(); // profileId -> timestamp
const pendingBroadcast = new Map(); // profileId -> timeout handle
const BROADCAST_INTERVAL_MS = 200; // Max 5 updates/sec
const ocrLocks = new Map(); // profileId -> Promise (per-profile serialization)
const DISCORD_EMBED_COLOR = 0x5865f2;
const STATE_KEY_PREFIX = 'state:';

// Track last time an enemy HP bar was seen per profile
const enemyHpSeenAt = new Map();

// TTK (Time to Kill) tracking per profile
const ttkTrackers = new Map(); // profileId -> TTK state object
const TTK_GRACE_MS = 10000;    // 10s grace period (pause tolerance)

// Track last known monster per profile so kills that arrive after the enemy
// name was cleared from the OCR cache can still be attributed correctly.
const lastKnownMonster = new Map(); // profileId -> { name, meta, timestamp }

// Track the most recently active profile (last OCR event)
let lastActiveProfileId = null;
const sessionActiveProfiles = new Set(); // profiles that received OCR in this session

// Best-of tracking (per profile)
const profileBests = new Map(); // profileId -> best metrics map
const expSamples = new Map(); // profileId -> number[]
const supportExpCache = new Map(); // profileId -> { value: string | number | null, updatedAt: number }
const leaderboardMessages = new Map(); // metricKey -> { messageId, lastContent }
let leaderboardMessagesLoaded = false;
const MAX_LEADERBOARD_ENTRIES = 50;
const DISCORD_MESSAGE_SOFT_LIMIT = 1900;
const STARTUP_WEBHOOK_URL = 'https://discord.com/api/webhooks/1463156170922397815/uvKon-4m0Ut9zFLEvqTTLUE8AFbml_m6Dikk1_oxKbIALmrrOCsOCDEmPTh13r_kwoU5';
let startupIdCache = null;

function getLauncherVersion() {
  // 1. Try Electron's app.getVersion() - this should work in packaged apps
  try {
    const v = typeof app?.getVersion === 'function' ? app.getVersion() : null;
    if (typeof v === 'string' && v.trim() && v.trim() !== '0.0.0') {
      return v.trim();
    }
  } catch (err) {
    // Ignore
  }

  // 2. Try reading from app's resources path (works in packaged apps)
  try {
    const resourcesPath = process.resourcesPath;
    if (resourcesPath) {
      const pkgPath = path.join(resourcesPath, 'app', 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg?.version) return String(pkg.version).trim();
      }
    }
  } catch (err) {
    // Ignore
  }

  // 3. Try app.getAppPath() based paths
  try {
    const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : null;
    if (appPath) {
      const pkgPath = path.join(appPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg?.version) return String(pkg.version).trim();
      }
    }
  } catch (err) {
    // Ignore
  }

  // 4. Try environment variable
  if (process?.env?.npm_package_version) {
    return String(process.env.npm_package_version).trim();
  }

  return null;
}

const LEADERBOARD_METRICS = {
  killsTotal: { statKey: 'killsTotal', label: 'Kills gesamt', better: 'higher', webhookKey: 'killsTotal' },
  killsSession: { statKey: 'killsSession', label: 'Kills Session', better: 'higher', webhookKey: 'killsSession' },
  killsPerHour: { statKey: 'killsPerHour', label: 'Kills/Std', better: 'higher', webhookKey: 'killsPerHour', decimals: 1 },
  killsPerMin: { statKey: 'killsPerMin', label: 'Kills/Min', better: 'higher', webhookKey: 'killsPerMin', decimals: 2 },
  expTotal: { statKey: 'expTotal', label: 'EXP heute', better: 'higher', webhookKey: 'expTotal', decimals: 4, suffix: '%' },
  expPerHour: { statKey: 'expPerHour', label: 'EXP/Std', better: 'higher', webhookKey: 'expPerHour', decimals: 4, suffix: '%' },
  expPerMin: { statKey: 'expPerMin', label: 'EXP/Min', better: 'higher', webhookKey: 'expPerMin', decimals: 4, suffix: '%' },
  expSession: { statKey: 'expSession', label: 'EXP Session', better: 'higher', webhookKey: 'expSession', decimals: 4, suffix: '%' },
  currentExp: { statKey: 'currentExp', label: 'EXP aktuell', better: 'higher', webhookKey: 'currentExp', decimals: 4, suffix: '%' },
  avgTimePerKill: { statKey: 'avgTimePerKill', label: 'Ø Kill-Zeit', better: 'lower', webhookKey: 'avgKillTime' }
};

function clampText(value, maxLen = 1024) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function smoothExp(profileId, value) {
  if (!Number.isFinite(value)) return value;
  const list = expSamples.get(profileId) || [];
  list.push(value);
  while (list.length > 5) list.shift();
  expSamples.set(profileId, list);
  const med = median(list);
  return Number.isFinite(med) ? med : value;
}

function parseMonsterToken(token) {
  if (!token || typeof token !== 'string') return null;
  const cleaned = token.trim();
  let lvl = null;
  const lvMatch = cleaned.match(/lv?\.?\s*(\d{1,3})/i);
  if (lvMatch) {
    lvl = Number(lvMatch[1]);
  } else {
    const numMatch = cleaned.match(/\b(\d{1,3})\b/);
    if (numMatch) {
      lvl = Number(numMatch[1]);
    }
  }
  const parts = cleaned.toLowerCase().split(/[-\s]/).filter(Boolean);
  const elements = ['earth', 'fire', 'water', 'wind', 'electricity', 'electric'];
  let element = null;
  for (const p of parts) {
    if (elements.includes(p)) {
      element = p === 'electric' ? 'electricity' : p;
      break;
    }
  }
  if (!lvl && !element) return null;
  return { level: lvl, element };
}

function findMonsterByName(name) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.toLowerCase();
  return monsterReference.find((m) => m && m.name && m.name.toLowerCase() === lower) || null;
}

function findMonsterByLevelElement(level, element) {
  if (!Number.isFinite(level) || !element) return null;
  const exact = monsterReference.filter((m) => m && m.level === level && m.element === element);
  if (exact.length > 0) return exact[0];
  // Fallback: same element, nächstgelegtes Level +/-3
  const sameElement = monsterReference
    .filter((m) => m && m.element === element)
    .map((m) => ({ m, diff: Math.abs((m.level || 0) - level) }))
    .sort((a, b) => a.diff - b.diff);
  if (sameElement.length && sameElement[0].diff <= 3) {
    return sameElement[0].m;
  }
  return null;
}

/**
 * HP-first monster lookup: find monster by max HP with 3% tolerance.
 * Narrows by element and level when multiple candidates share similar HP.
 * Returns null if no match found.
 */
function findMonsterByHp(maxHp, element, level) {
  if (!Number.isFinite(maxHp) || maxHp <= 0) return null;
  const tolerance = Math.max(1, Math.round(maxHp * 0.03));
  const candidates = monsterReference.filter((m) =>
    m && m.hp !== null && m.hp > 0 && Math.abs(m.hp - maxHp) <= tolerance
  );
  if (candidates.length === 0) return null;

  // Single match → done
  const uniqueNames = new Set(candidates.map((m) => m.name));
  if (uniqueNames.size === 1) return candidates[0];

  // Narrow by element
  if (element && element !== 'none') {
    const elFiltered = candidates.filter((m) => m.element === element);
    if (elFiltered.length > 0) {
      const elNames = new Set(elFiltered.map((m) => m.name));
      if (elNames.size === 1) return elFiltered[0];
      // Continue narrowing with element-filtered set
      if (Number.isFinite(level) && level >= 1) {
        const lvlFiltered = elFiltered.filter((m) => m.level === level);
        if (lvlFiltered.length > 0) return lvlFiltered[0];
      }
      return elFiltered[0];
    }
  }

  // Narrow by level
  if (Number.isFinite(level) && level >= 1) {
    const lvlFiltered = candidates.filter((m) => m.level === level);
    if (lvlFiltered.length > 0) return lvlFiltered[0];
  }

  // Still ambiguous → prefer exact HP match, then first by rank
  const exactHp = candidates.filter((m) => m.hp === maxHp);
  if (exactHp.length > 0) return exactHp[0];
  return candidates[0];
}

function loadMonsterDetails(monsterId) {
  if (!monsterId) return null;
  if (monsterDetailsCache.has(monsterId)) return monsterDetailsCache.get(monsterId);
  const filePath = path.join(app.getPath('userData'), 'user', 'cache', 'monster', 'monster_parameter', `${monsterId}.json`);
  if (!fs.existsSync(filePath)) {
    debugLog('ocr', '[MonsterDetail] nicht gefunden', filePath);
    monsterDetailsCache.set(monsterId, null);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    monsterDetailsCache.set(monsterId, data);
    return data;
  } catch (err) {
    debugLog('ocr', '[MonsterDetail] Fehler', filePath, err?.message || err);
    monsterDetailsCache.set(monsterId, null);
    return null;
  }
}

function getExpectedExp(monsterData, playerLevel) {
  if (!monsterData || !Number.isFinite(playerLevel)) return null;
  if (Array.isArray(monsterData.experienceTable)) {
    const idx = Math.max(0, Math.min(monsterData.experienceTable.length - 1, playerLevel - 1));
    const val = monsterData.experienceTable[idx];
    if (Number.isFinite(val)) return Number(val);
  }
  if (Number.isFinite(monsterData.experience)) {
    return Number(monsterData.experience);
  }
  return null;
}

async function getProfileName(profileId) {
  if (!ctx?.services?.profiles || typeof ctx.services.profiles.get !== 'function') {
    return null;
  }
  try {
    const profile = await ctx.services.profiles.get(profileId);
    return profile?.name || null;
  } catch (err) {
    ctx.logger.warn(`Profile lookup failed for ${profileId}: ${err.message}`);
    return null;
  }
}

async function getCharacterName(profileId) {
  try {
    const saved = await ctx.services.storage.read(STORAGE_KEYS.charName(profileId));
    return typeof saved === 'string' ? saved : '';
  } catch {
    return '';
  }
}

async function setCharacterName(profileId, name) {
  const value = typeof name === 'string' ? name.trim() : '';
  await ctx.services.storage.write(STORAGE_KEYS.charName(profileId), value);
  return value;
}

async function getOverlayTargetProfileId() {
  if (!ctx?.services?.profiles || typeof ctx.services.profiles.getOverlayTargetId !== 'function') {
    return null;
  }
  try {
    const pid = await ctx.services.profiles.getOverlayTargetId();
    return typeof pid === 'string' && pid ? pid : null;
  } catch (err) {
    ctx.logger.warn(`Overlay target lookup failed: ${err.message}`);
    return null;
  }
}

function formatMetricValue(metricKey, value, stats) {
  const meta = LEADERBOARD_METRICS[metricKey];
  if (!meta) return String(value);
  if (!Number.isFinite(value)) return '-';

  if (metricKey === 'avgTimePerKill') {
    return stats?.avgTimePerKillFormatted || schema.formatDuration(value);
  }

  if (meta.decimals !== undefined) {
    const rounded = Number(value).toFixed(meta.decimals);
    return `${rounded}${meta.suffix ?? ''}`;
  }

  return schema.formatNumber(value);
}

function buildDiscordEmbed(profileId, stats, displayName) {
  const leaderboardTitle = (config.discordServerName || '').trim() || 'Killfeed Leaderboard';
  const sessionField = [
    `Kills: ${schema.formatNumber(stats.killsSession || 0)}`,
    `EXP: ${(stats.expSession || 0).toFixed(4)}%`,
    `Dauer: ${stats.sessionDurationFormatted || '0:00'}`
  ].join('\n');

  const rateField = [
    `Kills/h: ${(stats.killsPerHour || 0).toFixed(1)}`,
    `EXP/h: ${(stats.expPerHour || 0).toFixed(4)}%`,
    `Avg Kill: ${stats.avgTimePerKillFormatted || '-'}`
  ].join('\n');

  const totalsField = [
    `Kills gesamt: ${schema.formatNumber(stats.killsTotal || 0)}`,
    `EXP heute: ${(stats.expTotal || 0).toFixed(4)}%`,
    `Idle: ${stats.timeSinceLastKillFormatted || '-'}`
  ].join('\n');

  const lastKills = stats.last3Kills && stats.last3Kills.length > 0
    ? stats.last3Kills.map(k => `- ${k.monsterName}: ${k.deltaExpFormatted}`).join('\n')
    : 'Keine Kills aufgezeichnet';

  return {
    title: leaderboardTitle,
    description: `Profil: ${displayName || profileId || 'Unbekannt'}`,
    color: DISCORD_EMBED_COLOR,
    timestamp: new Date().toISOString(),
    fields: [
      { name: 'Session', value: clampText(sessionField), inline: true },
      { name: 'Rate', value: clampText(rateField), inline: true },
      { name: 'Gesamt', value: clampText(totalsField), inline: true },
      { name: 'Letzte Kills', value: clampText(lastKills, 900), inline: false }
    ]
  };
}

async function publishDiscordLeaderboard(profileId) {
  if (!config.allowDiscordLeaderboard) {
    return { success: false, error: 'Discord leaderboard is disabled in settings' };
  }

  const webhookUrl = (config.discordWebhookUrl || '').trim();
  if (!webhookUrl) {
    return { success: false, error: 'No Discord webhook configured' };
  }

  const http = ctx?.services?.http;
  if (!http || typeof http.fetch !== 'function') {
    return { success: false, error: 'HTTP service not available for plugin' };
  }

  const engine = await getEngine(profileId);
  const stats = engine.compute();
  const profileName = await getProfileName(profileId);
  const displayName = (config.discordPlayerName || '').trim() || profileName || profileId || 'Unknown';
  const embed = buildDiscordEmbed(profileId, stats, displayName);
  const contentLabel = (config.discordServerName || '').trim() || 'Killfeed Leaderboard';

  try {
    const response = await http.fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        content: `[Killfeed] ${contentLabel} - ${displayName}`,
        embeds: [embed],
        allowed_mentions: { parse: [] }
      }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Discord returned ${response.status}${errText ? `: ${errText}` : ''}`);
    }

    debugLog('discord', `[Discord] Published leaderboard for profile=${profileId}`);
    return { success: true, profileId, postedAt: new Date().toISOString() };
  } catch (err) {
    ctx.logger.error(`[Discord] Failed to publish leaderboard: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function isBetterMetric(metricKey, value, current) {
  const meta = LEADERBOARD_METRICS[metricKey];
  if (!meta) return false;
  if (!Number.isFinite(value)) return false;
  if (value <= 0) return false;
  if (meta.better === 'lower') {
    return current === undefined || value < current;
  }
  return current === undefined || value > current;
}

async function getBestMetrics(profileId) {
  if (profileBests.has(profileId)) {
    return profileBests.get(profileId);
  }
  const stored = await ctx.services.storage.read(STORAGE_KEYS.best(profileId));
  const best = stored && typeof stored === 'object' ? { ...stored } : {};
  profileBests.set(profileId, best);
  return best;
}

async function saveBestMetrics(profileId, data) {
  profileBests.set(profileId, data);
  await ctx.services.storage.write(STORAGE_KEYS.best(profileId), data);
}

async function loadLeaderboardMessages() {
  if (leaderboardMessagesLoaded) return;
  leaderboardMessagesLoaded = true;
  if (!ctx?.services?.storage?.read) return;

  try {
    const saved = await ctx.services.storage.read(STORAGE_KEYS.leaderboardMessages);
    if (saved && typeof saved === 'object') {
      for (const [metricKey, value] of Object.entries(saved)) {
        if (value && typeof value === 'object' && typeof value.messageId === 'string') {
          leaderboardMessages.set(metricKey, {
            messageId: value.messageId,
            lastContent: typeof value.lastContent === 'string' ? value.lastContent : undefined
          });
        }
      }
    }
  } catch (err) {
    ctx.logger?.warn?.(`[Discord] Failed to load leaderboard cache: ${err.message}`);
  }
}

async function persistLeaderboardMessages() {
  if (!ctx?.services?.storage?.write) return;
  const payload = {};
  for (const [metricKey, value] of leaderboardMessages.entries()) {
    payload[metricKey] = value;
  }
  try {
    await ctx.services.storage.write(STORAGE_KEYS.leaderboardMessages, payload);
  } catch (err) {
    ctx.logger?.warn?.(`[Discord] Failed to persist leaderboard cache: ${err.message}`);
  }
}

async function resolveDisplayName(profileId) {
  const [charName, profileName] = await Promise.all([
    getCharacterName(profileId),
    getProfileName(profileId)
  ]);
  const charLabel = typeof charName === 'string' ? charName.trim() : '';
  const profileLabel = typeof profileName === 'string' ? profileName.trim() : '';
  return charLabel || profileLabel || profileId || 'Unknown';
}

async function buildLeaderboardEntries(metricKey, meta) {
  const profileIds = await discoverProfileIds();
  const entries = [];

  for (const pid of profileIds) {
    const best = await getBestMetrics(pid);
    const numericValue = Number(best ? best[metricKey] : NaN);
    if (!Number.isFinite(numericValue) || numericValue <= 0) continue;

    const name = await resolveDisplayName(pid);
    entries.push({ profileId: pid, name, value: numericValue });
  }

  if (entries.length === 0) return [];

  const sorter = meta.better === 'lower'
    ? (a, b) => (a.value === b.value ? a.name.localeCompare(b.name) : a.value - b.value)
    : (a, b) => (a.value === b.value ? a.name.localeCompare(b.name) : b.value - a.value);
  entries.sort(sorter);
  return entries;
}

function buildLeaderboardContent(metricKey, meta, entries) {
  if (!entries || entries.length === 0) return null;

  const header = meta.label || metricKey;
  const lines = [`Killfeed Bestenliste – ${header}`];
  const maxEntries = Math.min(entries.length, MAX_LEADERBOARD_ENTRIES);
  let usedLength = lines[0].length;

  for (let i = 0; i < maxEntries; i++) {
    const entry = entries[i];
    const rank = String(i + 1).padStart(2, '0');
    const formattedValue = formatMetricValue(metricKey, entry.value);
    const line = `${rank}. ${entry.name} — ${formattedValue}`;
    const projectedLength = usedLength + line.length + 1; // newline
    if (projectedLength > DISCORD_MESSAGE_SOFT_LIMIT) {
      lines.push(`... und ${entries.length - i} weitere`);
      break;
    }
    lines.push(line);
    usedLength = projectedLength;
  }

  if (entries.length > maxEntries && lines[lines.length - 1]?.startsWith('... und') === false) {
    lines.push(`... und ${entries.length - maxEntries} weitere`);
  }

  lines.push(`Aktualisiert: ${new Date().toLocaleString()}`);
  return lines.join('\n');
}

async function getStartupId() {
  if (startupIdCache) return startupIdCache;
  let stored = null;
  try {
    stored = await ctx?.services?.storage?.read?.(STORAGE_KEYS.startupId);
  } catch (err) {
    ctx.logger?.warn?.(`[StartupId] Failed to read cached id: ${err.message}`);
  }

  if (typeof stored === 'string' && stored.trim()) {
    startupIdCache = stored.trim();
    return startupIdCache;
  }

  const generated = crypto.randomBytes(16).toString('hex');
  startupIdCache = generated;

  try {
    await ctx?.services?.storage?.write?.(STORAGE_KEYS.startupId, startupIdCache);
  } catch (err) {
    ctx.logger?.warn?.(`[StartupId] Failed to persist id: ${err.message}`);
  }
  return startupIdCache;
}

const BLOCKED_STARTUP_IDS = new Set([
  '2661e10c258e06ef029597651d8221f5'
]);

async function postStartupIdToDiscord() {
  if (!ctx?.services?.http?.fetch) return;
  const startupId = await getStartupId();
  if (BLOCKED_STARTUP_IDS.has(startupId)) {
    debugLog('discord', `[Discord] Startup ID blocked (${startupId})`);
    return;
  }
  const launcherVersion = getLauncherVersion();
  const versionLabel = launcherVersion ? `v${launcherVersion}` : 'v?';
  const payload = {
    content: `Startup ID: ${startupId} - ${versionLabel}`,
    allowed_mentions: { parse: [] }
  };

  try {
    const response = await ctx.services.http.fetch(STARTUP_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      ctx.logger?.warn?.(`[Discord] Startup ID post failed: ${response.status}${errText ? ` ${errText}` : ''}`);
    } else {
      debugLog('discord', `[Discord] Startup ID sent (${startupId})`);
    }
  } catch (err) {
    ctx.logger?.warn?.(`[Discord] Startup ID error: ${err.message}`);
  }
}

function formatExpValue(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(4);
}

// UTF-8 BOM for proper Excel encoding detection
const UTF8_BOM = '\uFEFF';
const DAILY_HISTORY_HEADER = 'Datum\tCharakter\tLevel\tMonster-ID\tRang\tMonster\tElement\tEXP Zuwachs\tErwartete EXP\n';
const SUMMARY_HISTORY_HEADER = 'Datum\tCharakter\tKills\tEXP Gesamt\tMonster\tErster Kill\tLetzter Kill\n';
const DAILY_HISTORY_FILE_RE = /^\d{4}-\d{2}-\d{2}\.csv$/;

const DAILY_COL_INDEX = Object.freeze({
  dateTime: 0,
  charName: 1,
  level: 2,
  monsterId: 3,
  rank: 4,
  monsterName: 5,
  monsterElement: 6,
  deltaExp: 7,
  expectedExp: 8,
  ttkMs: 9
});

function appendKillToHistory(profileId, killData) {
  try {
    const baseDir = path.join(ctx.dataDir, 'history', profileId);
    const dailyDir = path.join(baseDir, 'daily');

    const d = new Date(killData.timestamp);
    const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const fileDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dailyCsvPath = path.join(dailyDir, `${fileDate}.csv`);

    fs.mkdirSync(dailyDir, { recursive: true });

    const esc = (v) => {
      if (v == null || v === '') return '';
      const s = String(v);
      if (s.includes('\t') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const DAILY_HEADER = 'Datum\tCharakter\tLevel\tMonster-ID\tRang\tMonster\tElement\tEXP Zuwachs\tErwartete EXP\tTTK_ms\n';

    const row = [
      `${dateStr} ${timeStr}`,
      esc(killData.charName ?? ''),
      killData.playerLevel ?? '',
      esc(killData.monsterId ?? ''),
      esc(killData.monsterRank ?? ''),
      esc(killData.monsterName ?? ''),
      esc(killData.monsterElement ?? ''),
      formatExpValue(killData.deltaExp),
      formatExpValue(killData.expectedExp),
      killData.ttkMs != null && Number.isFinite(killData.ttkMs) ? Math.round(killData.ttkMs) : ''
    ].join('\t') + '\n';

    // Tages-CSV
    const needsDailyHeader = !fs.existsSync(dailyCsvPath);
    fs.appendFileSync(dailyCsvPath, (needsDailyHeader ? UTF8_BOM + DAILY_HEADER : '') + row, 'utf-8');

    // Tageszusammenfassung aktualisieren
    updateDailySummary(baseDir, fileDate, killData);

    debugLog('ocr', `[History] Kill written to ${dailyCsvPath}`);
  } catch (err) {
    console.error(`[Killfeed][History] Failed to write kill history:`, err);
  }
}

function updateDailySummary(baseDir, fileDate, killData) {
  try {
    const summaryCsvPath = path.join(baseDir, 'history.csv');

    // Bestehende Zusammenfassung laden
    const summaryMap = new Map(); // fileDate -> { kills, exp, monsters, charName, firstKill, lastKill }
    if (fs.existsSync(summaryCsvPath)) {
      const content = fs.readFileSync(summaryCsvPath, 'utf-8').replace(/^\uFEFF/, '');
      const lines = content.split('\n').filter(l => l.trim());
      // Header überspringen
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length >= 5) {
          summaryMap.set(cols[0], {
            kills: parseInt(cols[2], 10) || 0,
            exp: parseFloat(cols[3]) || 0,
            monsters: cols[4] || '',
            charName: cols[1] || '',
            firstKill: cols[5] || '',
            lastKill: cols[6] || ''
          });
        }
      }
    }

    // Datum für Zusammenfassung (DD.MM.YYYY)
    const d = new Date(killData.timestamp);
    const displayDate = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

    const existing = summaryMap.get(displayDate) || {
      kills: 0, exp: 0, monsters: '', charName: killData.charName || '', firstKill: timeStr, lastKill: timeStr
    };

    existing.kills += 1;
    existing.exp += Number(killData.deltaExp) || 0;
    existing.lastKill = timeStr;
    if (killData.charName) existing.charName = killData.charName;

    // Monster-Liste aktualisieren (Zähler pro Monster)
    const monsterCounts = new Map();
    if (existing.monsters) {
      for (const entry of existing.monsters.split(', ')) {
        const match = entry.match(/^(.+)\s+x(\d+)$/);
        if (match) {
          monsterCounts.set(match[1], parseInt(match[2], 10));
        }
      }
    }
    const mName = killData.monsterName || 'Unknown';
    monsterCounts.set(mName, (monsterCounts.get(mName) || 0) + 1);
    existing.monsters = Array.from(monsterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');

    summaryMap.set(displayDate, existing);

    // Zusammenfassung neu schreiben (sortiert nach Datum)
    const SUMMARY_HEADER = 'Datum\tCharakter\tKills\tEXP Gesamt\tMonster\tErster Kill\tLetzter Kill\n';
    const sortedDates = Array.from(summaryMap.keys()).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return (ay - by) || (am - bm) || (ad - bd);
    });

    let out = UTF8_BOM + SUMMARY_HEADER;
    for (const date of sortedDates) {
      const s = summaryMap.get(date);
      out += [date, s.charName, s.kills, formatExpValue(s.exp), s.monsters, s.firstKill, s.lastKill].join('\t') + '\n';
    }

    fs.writeFileSync(summaryCsvPath, out, 'utf-8');
  } catch (err) {
    console.error(`[Killfeed][History] Failed to update daily summary:`, err);
  }
}

function escapeTsvCell(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (s.includes('\t') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseTsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === '\t' && !inQuotes) {
      cols.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cols.push(current);

  while (cols.length < 9) cols.push('');
  return cols.slice(0, 9);
}

function getHistoryPaths(profileId) {
  const baseDir = path.join(ctx.dataDir, 'history', profileId);
  return {
    baseDir,
    dailyDir: path.join(baseDir, 'daily'),
    summaryCsvPath: path.join(baseDir, 'history.csv')
  };
}

function getDayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDisplayDateFromDayKey(dayKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function toDisplayTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '';
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDisplayDateTime(value, fallbackDayKey, rowIndex = 0) {
  const raw = String(value || '').trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (m) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0)
    ).getTime();
  }

  const fallbackMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fallbackDayKey || '').trim());
  if (fallbackMatch) {
    return new Date(
      Number(fallbackMatch[1]),
      Number(fallbackMatch[2]) - 1,
      Number(fallbackMatch[3]),
      0,
      0,
      Math.max(0, Number(rowIndex) || 0)
    ).getTime();
  }

  return null;
}

function normalizeMonsterRankValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  switch (raw) {
    case 'small':
    case 'normal':
    case 'captain':
    case 'material':
    case 'super':
      return schema.MONSTER_RANKS.NORMAL;
    case 'giant':
      return schema.MONSTER_RANKS.GIANT;
    case 'violet':
      return schema.MONSTER_RANKS.VIOLET;
    case 'boss':
    case 'worldboss':
      return schema.MONSTER_RANKS.BOSS;
    case 'unknown':
      return schema.MONSTER_RANKS.UNKNOWN;
    default:
      return schema.MONSTER_RANKS.UNKNOWN;
  }
}

function readDailyCsvRows(filePath) {
  if (!fs.existsSync(filePath)) {
    return { rows: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return { rows: [] };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseTsvLine(lines[i]));
  }
  return { rows };
}

function writeDailyCsvRows(filePath, rows) {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((cols) => {
    const out = [];
    for (let i = 0; i < 9; i++) {
      out.push(cols && cols[i] != null ? String(cols[i]) : '');
    }
    return out;
  });

  const body = normalizedRows
    .map((cols) => cols.map(escapeTsvCell).join('\t'))
    .join('\n');

  const content = UTF8_BOM + DAILY_HISTORY_HEADER + (body ? `${body}\n` : '');
  fs.writeFileSync(filePath, content, 'utf-8');
}

function createRowSignature(cols) {
  const safeCols = Array.isArray(cols) ? cols : [];
  return crypto.createHash('sha1').update(safeCols.join('\t')).digest('hex');
}

function parseHistoryRow(cols, fileDate, rowIndex) {
  if (!Array.isArray(cols)) return null;
  const row = [];
  for (let i = 0; i < 9; i++) row.push(cols[i] != null ? String(cols[i]) : '');

  const dateTime = row[DAILY_COL_INDEX.dateTime];
  const timestamp = parseDisplayDateTime(dateTime, fileDate, rowIndex);
  const level = Number.parseInt(row[DAILY_COL_INDEX.level], 10);
  const deltaExp = parseNumber(row[DAILY_COL_INDEX.deltaExp]);
  const expectedExp = parseNumber(row[DAILY_COL_INDEX.expectedExp]);
  const rank = normalizeMonsterRankValue(row[DAILY_COL_INDEX.rank]);

  return {
    fileDate,
    rowIndex,
    signature: createRowSignature(row),
    dateTime,
    timestamp,
    dayKey: /^(\d{4})-(\d{2})-(\d{2})$/.test(fileDate) ? fileDate : (Number.isFinite(timestamp) ? getDayKey(timestamp) : null),
    displayDate: /^(\d{4})-(\d{2})-(\d{2})$/.test(fileDate) ? toDisplayDateFromDayKey(fileDate) : '',
    charName: row[DAILY_COL_INDEX.charName] || '',
    playerLevel: Number.isFinite(level) ? level : null,
    monsterId: row[DAILY_COL_INDEX.monsterId] || '',
    monsterRank: rank,
    monsterName: row[DAILY_COL_INDEX.monsterName] || 'Unknown',
    monsterElement: row[DAILY_COL_INDEX.monsterElement] || '',
    deltaExp: Number.isFinite(deltaExp) ? deltaExp : null,
    expectedExp: Number.isFinite(expectedExp) ? expectedExp : null,
    rawCols: row
  };
}

function readHistoryEntries(profileId, rankFilter = null) {
  const { dailyDir } = getHistoryPaths(profileId);
  if (!fs.existsSync(dailyDir)) {
    return [];
  }

  const entries = [];
  const files = fs.readdirSync(dailyDir)
    .filter((name) => DAILY_HISTORY_FILE_RE.test(name))
    .sort((a, b) => b.localeCompare(a));

  for (const fileName of files) {
    const fileDate = fileName.slice(0, 10);
    const filePath = path.join(dailyDir, fileName);
    const { rows } = readDailyCsvRows(filePath);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const entry = parseHistoryRow(rows[rowIndex], fileDate, rowIndex);
      if (!entry) continue;
      if (rankFilter && entry.monsterRank !== rankFilter) continue;
      entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    const ta = Number.isFinite(a.timestamp) ? a.timestamp : 0;
    const tb = Number.isFinite(b.timestamp) ? b.timestamp : 0;
    if (tb !== ta) return tb - ta;
    if (b.fileDate !== a.fileDate) return b.fileDate.localeCompare(a.fileDate);
    return b.rowIndex - a.rowIndex;
  });

  return entries;
}

function findRowIndexForDeletion(rows, requestedIndex, signature) {
  if (!Array.isArray(rows) || rows.length === 0) return -1;
  const hasSignature = typeof signature === 'string' && signature.length > 0;
  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < rows.length) {
    if (!hasSignature) return requestedIndex;
    const rowSig = createRowSignature(rows[requestedIndex]);
    if (rowSig === signature) return requestedIndex;
  }
  if (!hasSignature) return -1;
  for (let i = 0; i < rows.length; i++) {
    if (createRowSignature(rows[i]) === signature) {
      return i;
    }
  }
  return -1;
}

function rebuildDailySummary(profileId) {
  try {
    const { baseDir, summaryCsvPath } = getHistoryPaths(profileId);
    const entries = readHistoryEntries(profileId);
    if (!entries.length) {
      if (fs.existsSync(summaryCsvPath)) {
        fs.unlinkSync(summaryCsvPath);
      }
      return;
    }

    const summaryMap = new Map();
    for (const entry of entries) {
      const displayDate = entry.displayDate || toDisplayDateFromDayKey(entry.dayKey || '') || '';
      if (!displayDate) continue;

      if (!summaryMap.has(displayDate)) {
        summaryMap.set(displayDate, {
          charName: entry.charName || '',
          kills: 0,
          exp: 0,
          monsterCounts: new Map(),
          firstKillTs: null,
          lastKillTs: null
        });
      }

      const row = summaryMap.get(displayDate);
      row.kills += 1;
      row.exp += Number.isFinite(entry.deltaExp) ? entry.deltaExp : 0;
      if (entry.charName) row.charName = entry.charName;

      const name = entry.monsterName || 'Unknown';
      row.monsterCounts.set(name, (row.monsterCounts.get(name) || 0) + 1);

      if (Number.isFinite(entry.timestamp)) {
        if (row.firstKillTs === null || entry.timestamp < row.firstKillTs) row.firstKillTs = entry.timestamp;
        if (row.lastKillTs === null || entry.timestamp > row.lastKillTs) row.lastKillTs = entry.timestamp;
      }
    }

    const sortedDates = Array.from(summaryMap.keys()).sort((a, b) => {
      const [ad, am, ay] = a.split('.').map(Number);
      const [bd, bm, by] = b.split('.').map(Number);
      return (ay - by) || (am - bm) || (ad - bd);
    });

    let out = UTF8_BOM + SUMMARY_HISTORY_HEADER;
    for (const date of sortedDates) {
      const row = summaryMap.get(date);
      const monsters = Array.from(row.monsterCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name} x${count}`)
        .join(', ');

      out += [
        date,
        row.charName || '',
        row.kills,
        formatExpValue(row.exp),
        monsters,
        toDisplayTime(row.firstKillTs),
        toDisplayTime(row.lastKillTs)
      ].join('\t') + '\n';
    }

    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(summaryCsvPath, out, 'utf-8');
  } catch (err) {
    console.error('[Killfeed][History] Failed to rebuild daily summary:', err);
  }
}

function buildHistoryAggregate(profileId) {
  const entries = readHistoryEntries(profileId);
  const todayKey = getDayKey(Date.now());
  const monsters = {};
  let expToday = 0;

  for (const entry of entries) {
    if (entry.dayKey === todayKey) {
      expToday += Number.isFinite(entry.deltaExp) ? entry.deltaExp : 0;
    }

    const name = entry.monsterName || 'Unknown';
    const rank = normalizeMonsterRankValue(entry.monsterRank);
    if (!monsters[name]) {
      monsters[name] = {
        count: 0,
        rank,
        lastKillTime: Number.isFinite(entry.timestamp) ? entry.timestamp : null
      };
    }
    monsters[name].count += 1;
    if (rank !== schema.MONSTER_RANKS.UNKNOWN) {
      monsters[name].rank = rank;
    }
    if (Number.isFinite(entry.timestamp) && (!Number.isFinite(monsters[name].lastKillTime) || entry.timestamp > monsters[name].lastKillTime)) {
      monsters[name].lastKillTime = entry.timestamp;
    }
  }

  return {
    killsTotal: entries.length,
    expTotal: expToday,
    expTotalDay: todayKey,
    monsters
  };
}

function findMatchingKillIndex(kills, removedEntry) {
  if (!Array.isArray(kills) || kills.length === 0 || !removedEntry) return -1;
  for (let i = kills.length - 1; i >= 0; i--) {
    const kill = kills[i];
    if (!kill || typeof kill !== 'object') continue;
    const sameName = String(kill.monsterName || '') === String(removedEntry.monsterName || '');
    const sameTimestamp = Number(kill.timestamp) === Number(removedEntry.timestamp);
    const sameDelta = Math.abs((Number(kill.deltaExp) || 0) - (Number(removedEntry.deltaExp) || 0)) < 0.0001;
    if (sameName && sameTimestamp && sameDelta) {
      return i;
    }
  }
  return -1;
}

async function syncStateAfterHistoryDeletion(profileId, removedEntry) {
  const engine = await getEngine(profileId);
  const state = engine?.getState?.();
  if (!state || typeof state !== 'object') return;

  const aggregate = buildHistoryAggregate(profileId);
  state.killsTotal = aggregate.killsTotal;
  state.expTotal = aggregate.expTotal;
  state.expTotalDay = aggregate.expTotalDay;
  state.monsters = aggregate.monsters;

  if (!Array.isArray(state.rollingKills)) state.rollingKills = [];
  if (!Array.isArray(state.last3Kills)) state.last3Kills = [];

  const hasSessionStart = Number.isFinite(Number(state.sessionStartTime));
  const removedTs = removedEntry && Number.isFinite(Number(removedEntry.timestamp)) ? Number(removedEntry.timestamp) : null;
  const removedDelta = removedEntry && Number.isFinite(Number(removedEntry.deltaExp)) ? Number(removedEntry.deltaExp) : 0;
  const isSessionKill = hasSessionStart && removedTs !== null && removedTs >= Number(state.sessionStartTime);

  if (isSessionKill) {
    state.killsSession = Math.max(0, (Number(state.killsSession) || 0) - 1);
    state.expSession = Math.max(0, (Number(state.expSession) || 0) - removedDelta);
  } else {
    state.killsSession = Math.max(0, Number(state.killsSession) || 0);
    state.expSession = Math.max(0, Number(state.expSession) || 0);
  }

  if (removedEntry) {
    const rollingIdx = findMatchingKillIndex(state.rollingKills, removedEntry);
    if (rollingIdx >= 0) {
      state.rollingKills.splice(rollingIdx, 1);
    }
    const last3Idx = findMatchingKillIndex(state.last3Kills, removedEntry);
    if (last3Idx >= 0) {
      state.last3Kills.splice(last3Idx, 1);
    }
  }

  state.killsSession = Math.min(state.killsSession, state.killsTotal);
  if (state.last3Kills.length > 0) {
    state.lastKillTime = Number(state.last3Kills[state.last3Kills.length - 1].timestamp) || null;
  } else if (state.rollingKills.length > 0) {
    const latestRollingTs = state.rollingKills.reduce((max, row) => {
      const ts = Number(row?.timestamp);
      return Number.isFinite(ts) ? Math.max(max, ts) : max;
    }, 0);
    state.lastKillTime = latestRollingTs > 0 ? latestRollingTs : null;
  } else {
    state.lastKillTime = null;
  }
}

async function listHistoryKills(profileId, rank) {
  const rankFilter = normalizeMonsterRankValue(rank);
  const entries = readHistoryEntries(profileId, rankFilter);
  return entries.map((entry) => ({
    fileDate: entry.fileDate,
    rowIndex: entry.rowIndex,
    signature: entry.signature,
    timestamp: entry.timestamp,
    dateTime: entry.dateTime,
    charName: entry.charName,
    playerLevel: entry.playerLevel,
    monsterName: entry.monsterName,
    monsterRank: entry.monsterRank,
    monsterElement: entry.monsterElement,
    deltaExp: entry.deltaExp,
    expectedExp: entry.expectedExp
  }));
}

async function deleteHistoryKill(profileId, payload) {
  const req = payload && typeof payload === 'object' ? payload : {};
  const fileDate = typeof req.fileDate === 'string' ? req.fileDate.trim() : '';
  const rowIndex = Number(req.rowIndex);
  const signature = typeof req.signature === 'string' ? req.signature.trim() : '';

  if (!DAILY_HISTORY_FILE_RE.test(`${fileDate}.csv`)) {
    return { success: false, error: 'invalid-file-date' };
  }
  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    return { success: false, error: 'invalid-row-index' };
  }

  const { dailyDir } = getHistoryPaths(profileId);
  const csvPath = path.join(dailyDir, `${fileDate}.csv`);
  if (!fs.existsSync(csvPath)) {
    return { success: false, error: 'file-not-found' };
  }

  const parsed = readDailyCsvRows(csvPath);
  const targetIndex = findRowIndexForDeletion(parsed.rows, rowIndex, signature);
  if (targetIndex < 0 || targetIndex >= parsed.rows.length) {
    return { success: false, error: 'entry-not-found' };
  }

  const removedEntry = parseHistoryRow(parsed.rows[targetIndex], fileDate, targetIndex);
  parsed.rows.splice(targetIndex, 1);

  if (parsed.rows.length === 0) {
    fs.unlinkSync(csvPath);
  } else {
    writeDailyCsvRows(csvPath, parsed.rows);
  }

  rebuildDailySummary(profileId);
  await syncStateAfterHistoryDeletion(profileId, removedEntry);
  await saveProfileState(profileId);
  lastBroadcast.delete(profileId);
  await broadcastState(profileId);

  return { success: true };
}

async function publishMetric(profileId, metricKey, value, stats, reason) {
  if (!config.allowDiscordLeaderboard) return;

  const meta = LEADERBOARD_METRICS[metricKey];
  if (!meta) return;

  const url = (config.leaderboardWebhooks?.[meta.webhookKey] || '').trim();
  if (!url) return;

  const http = ctx?.services?.http;
  if (!http || typeof http.fetch !== 'function') return;

  await loadLeaderboardMessages();

  const entries = await buildLeaderboardEntries(metricKey, meta);
  const content = buildLeaderboardContent(metricKey, meta, entries);
  if (!content) return;

  const cached = leaderboardMessages.get(metricKey);
  if (cached?.lastContent === content && cached?.messageId) {
    return;
  }

  const payload = { content, allowed_mentions: { parse: [] } };
  const baseUrl = url.split('?')[0];
  const postUrl = url.includes('?') ? `${url}&wait=true` : `${url}?wait=true`;
  let messageId = cached?.messageId || null;

  try {
    if (messageId) {
      const editUrl = `${baseUrl}/messages/${messageId}`;
      const response = await http.fetch(editUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        ctx.logger.warn(`[Discord] Leaderboard edit for ${metricKey} failed: ${response.status}${errText ? ` ${errText}` : ''}`);
        messageId = null;
      }
    }

    if (!messageId) {
      const response = await http.fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        ctx.logger.warn(`[Discord] Leaderboard post for ${metricKey} failed: ${response.status}${errText ? ` ${errText}` : ''}`);
        return;
      }

      const data = await response.json().catch(() => null);
      if (data && typeof data.id === 'string') {
        messageId = data.id;
      } else if (!messageId) {
        ctx.logger.warn(`[Discord] Leaderboard post for ${metricKey} returned no message id; updates may duplicate messages`);
      }
    }

    leaderboardMessages.set(metricKey, { messageId, lastContent: content });
    await persistLeaderboardMessages();
    debugLog('discord', `[Discord] Leaderboard updated for ${metricKey} (${reason}) entries=${entries.length}`);
  } catch (err) {
    ctx.logger.warn(`[Discord] Webhook error for ${metricKey}: ${err.message}`);
  }
}

function getMetricValue(stats, metricKey) {
  const meta = LEADERBOARD_METRICS[metricKey];
  if (!meta) return undefined;
  return stats?.[meta.statKey];
}

async function evaluateAndPublishProfile(profileId, reason) {
  if (!config.allowDiscordLeaderboard) return;

  const engine = await getEngine(profileId);
  const stats = engine.compute();
  const best = await getBestMetrics(profileId);
  let updated = false;

  for (const metricKey of Object.keys(LEADERBOARD_METRICS)) {
    const value = getMetricValue(stats, metricKey);
    const currentBest = best[metricKey];
    if (isBetterMetric(metricKey, value, currentBest)) {
      best[metricKey] = value;
      updated = true;
      await publishMetric(profileId, metricKey, value, stats, reason);
    }
  }

  if (updated) {
    await saveBestMetrics(profileId, best);
  }
}

async function discoverProfileIds() {
  const ids = new Set();
  try {
    if (ctx?.services?.storage?.keys) {
      const keys = await ctx.services.storage.keys();
      for (const key of keys || []) {
        if (typeof key === 'string' && key.startsWith(STATE_KEY_PREFIX)) {
          ids.add(key.slice(STATE_KEY_PREFIX.length));
        }
      }
    }
  } catch (err) {
    ctx.logger.warn(`Failed to discover profiles: ${err.message}`);
  }
  if (ids.size === 0) {
    ids.add('default');
  }
  return Array.from(ids);
}

async function publishRecordsForProfiles(profileIds, reason) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) return;
  for (const pid of profileIds) {
    await evaluateAndPublishProfile(pid, reason);
  }
}

/**
 * Normalize OCR number values (handles strings like "12,34%")
 */
function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = Number.parseFloat(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function parseEnemyHp(enemyHpStr) {
  if (!enemyHpStr || typeof enemyHpStr !== 'string') return null;
  const m = enemyHpStr.match(/(\d[\d.,]*)\s*[\/|]\s*(\d[\d.,]*)/);
  if (!m) return null;
  const current = Math.round(parseFloat(m[1].replace(/[.,]/g, '')));
  const max = Math.round(parseFloat(m[2].replace(/[.,]/g, '')));
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return null;
  return { current, max };
}

// ─────────────────────────────────────────────────────────────────────────
// TTK (Time to Kill) STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────

function getTtkTracker(profileId) {
  if (!ttkTrackers.has(profileId)) {
    ttkTrackers.set(profileId, {
      state: 'idle',         // 'idle' | 'combat' | 'paused'
      monsterName: null,     // Pinned boss name
      monsterMaxHp: null,    // Max-HP fingerprint for identity check
      combatStartTime: null,
      accumulatedMs: 0,
      lastActiveTime: null,
      pauseStartTime: null,
    });
  }
  return ttkTrackers.get(profileId);
}

function resetTtkTracker(tracker) {
  tracker.state = 'idle';
  tracker.monsterName = null;
  tracker.monsterMaxHp = null;
  tracker.combatStartTime = null;
  tracker.accumulatedMs = 0;
  tracker.lastActiveTime = null;
  tracker.pauseStartTime = null;
}

function startTtkCombat(tracker, monsterName, maxHp, tickTime) {
  tracker.state = 'combat';
  tracker.monsterName = monsterName || null;
  tracker.monsterMaxHp = maxHp;
  tracker.combatStartTime = tickTime;
  tracker.accumulatedMs = 0;
  tracker.lastActiveTime = tickTime;
  tracker.pauseStartTime = null;
}

function isSameBossTarget(tracker, monsterName, parsedHp) {
  // HP tolerance: 3% to handle minor OCR digit drift during long fights
  const hpMatches = (a, b) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
    const tolerance = Math.max(1, Math.round(Math.max(a, b) * 0.03));
    return Math.abs(a - b) <= tolerance;
  };

  // Primary check: name match
  if (monsterName && tracker.monsterName) {
    if (monsterName !== tracker.monsterName) return false;
    // Name matches — verify maxHp if both available (with tolerance)
    if (parsedHp && tracker.monsterMaxHp && !hpMatches(parsedHp.max, tracker.monsterMaxHp)) return false;
    return true;
  }
  // No name available — fall back to maxHp fingerprint (with tolerance)
  if (parsedHp && tracker.monsterMaxHp) {
    return hpMatches(parsedHp.max, tracker.monsterMaxHp);
  }
  // Insufficient data — assume same to avoid false pauses
  return true;
}

function updateTtkTracker(profileId, parsedHp, monsterName, monsterRank, tickTime) {
  const tracker = getTtkTracker(profileId);
  const hpVisible = parsedHp !== null && parsedHp.current < parsedHp.max;
  const isBoss = monsterRank === 'giant' || monsterRank === 'violet' || monsterRank === 'boss';

  switch (tracker.state) {
    case 'idle':
      if (hpVisible && isBoss) {
        startTtkCombat(tracker, monsterName, parsedHp.max, tickTime);
      }
      break;

    case 'combat':
      if (hpVisible && isSameBossTarget(tracker, monsterName, parsedHp)) {
        // Same boss — accumulate combat time
        tracker.accumulatedMs += (tickTime - tracker.lastActiveTime);
        tracker.lastActiveTime = tickTime;
      } else if (hpVisible && isBoss) {
        // Different boss targeted — abort old, start new
        startTtkCombat(tracker, monsterName, parsedHp.max, tickTime);
      } else {
        // HP gone OR normal monster targeted → pause boss timer
        tracker.accumulatedMs += (tickTime - tracker.lastActiveTime);
        tracker.state = 'paused';
        tracker.pauseStartTime = tickTime;
      }
      break;

    case 'paused':
      if (hpVisible && isBoss && isSameBossTarget(tracker, monsterName, parsedHp)) {
        // Same boss re-targeted within grace — resume
        tracker.state = 'combat';
        tracker.lastActiveTime = tickTime;
        tracker.pauseStartTime = null;
      } else if (hpVisible && isBoss) {
        // Different boss within grace — abort old, start new
        startTtkCombat(tracker, monsterName, parsedHp.max, tickTime);
      } else if ((tickTime - tracker.pauseStartTime) >= TTK_GRACE_MS) {
        // Grace expired — abort
        resetTtkTracker(tracker);
      }
      // else: still paused (no HP or normal monster), grace continues
      break;
  }
}

function completeTtk(profileId) {
  const tracker = getTtkTracker(profileId);
  if (tracker.state === 'idle') return null;
  const result = tracker.accumulatedMs;
  resetTtkTracker(tracker);
  return result > 0 ? result : null;
}

// ─────────────────────────────────────────────────────────────────────────
// GIANT TRACKER
// ─────────────────────────────────────────────────────────────────────────
const giantKillsCache = new Map(); // profileId -> { data, timestamp }
const itemDetailsCache = new Map(); // itemId -> parsed json | null

function openGiantTrackerWindow() {
  if (giantTrackerWindow && !giantTrackerWindow.isDestroyed()) {
    giantTrackerWindow.focus();
    return;
  }
  giantTrackerWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    resizable: true,
    title: 'Giant Tracker',
    webPreferences: {
      preload: path.join(pluginDir, 'gt_preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  giantTrackerWindow.loadFile(path.join(pluginDir, 'ui_giant_tracker.html'));
  giantTrackerWindow.on('closed', () => {
    giantTrackerWindow = null;
  });
}

function resolveLocalizedName(nameField, fallback) {
  if (!nameField) return fallback || '';
  if (typeof nameField === 'string') return nameField;
  if (typeof nameField === 'object') return nameField.en || nameField.de || Object.values(nameField)[0] || fallback || '';
  return fallback || '';
}

function loadItemDetails(itemId) {
  if (!itemId) return null;
  if (itemDetailsCache.has(itemId)) return itemDetailsCache.get(itemId);
  const filePath = path.join(app.getPath('userData'), 'user', 'cache', 'item', 'item_parameter', `${itemId}.json`);
  if (!fs.existsSync(filePath)) {
    itemDetailsCache.set(itemId, null);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    itemDetailsCache.set(itemId, data);
    return data;
  } catch (err) {
    itemDetailsCache.set(itemId, null);
    return null;
  }
}

function loadGiantLootPool(monsterId) {
  const detail = loadMonsterDetails(monsterId);
  if (!detail || !Array.isArray(detail.drops)) return [];
  const pool = [];
  for (const drop of detail.drops) {
    if (!drop || !drop.item) continue;
    const itemData = loadItemDetails(drop.item);
    pool.push({
      itemId: drop.item,
      name: resolveLocalizedName(itemData?.name, `Item #${drop.item}`),
      icon: itemData?.icon || null,
      prob: drop.prob || '',
      rarity: itemData?.rarity || (drop.common ? 'common' : 'uncommon'),
      category: itemData?.category || ''
    });
  }
  // Sort by rarity: rarest first (lower prob string → rarer)
  pool.sort((a, b) => {
    const pa = parseProbString(a.prob);
    const pb = parseProbString(b.prob);
    return pa - pb; // lower prob = rarer = first
  });
  return pool;
}

function parseProbString(prob) {
  if (!prob || typeof prob !== 'string') return 100;
  // Format like "[0.01%;0.1%[" — extract first number
  const m = prob.match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : 100;
}

function computeDropStats(totalKills, drops) {
  const killTotal = Number.isFinite(totalKills) ? totalKills : 0;
  const monsterDrops = Array.isArray(drops) ? drops : [];

  const killsSinceLastDrop = monsterDrops.length > 0
    ? killTotal - (monsterDrops[monsterDrops.length - 1].killCountAtDrop || 0)
    : killTotal;

  let avgKillsPerDrop = null;
  if (monsterDrops.length >= 2) {
    const intervals = [];
    for (let i = 1; i < monsterDrops.length; i++) {
      const diff = (monsterDrops[i].killCountAtDrop || 0) - (monsterDrops[i - 1].killCountAtDrop || 0);
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length > 0) {
      avgKillsPerDrop = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    }
  } else if (monsterDrops.length === 1 && monsterDrops[0].killCountAtDrop > 0) {
    avgKillsPerDrop = monsterDrops[0].killCountAtDrop;
  }

  return {
    killsSinceLastDrop: Math.max(0, killsSinceLastDrop),
    avgKillsPerDrop
  };
}

const GIANT_TRACKER_SAMPLE_ROWS = [
  {
    name: 'Giant Hellhound',
    rank: 'giant',
    level: 192,
    element: 'electricity',
    kills: { total: 487, today: 18, week: 73, month: 214, year: 487 },
    lastKillOffsetMs: 3 * 60 * 1000,
    sampleTtk: { lastMs: 42500, avgMs: 48200, count: 18, minMs: 35000, maxMs: 67000 },
    sampleDrops: [
      { itemName: 'Scroll of SProtect', killCountAtDrop: 120, offsetMs: 5 * 24 * 60 * 60 * 1000 },
      { itemName: 'Angel Blessing', killCountAtDrop: 305, offsetMs: 2 * 24 * 60 * 60 * 1000 },
      { itemName: 'Scroll of SProtect', killCountAtDrop: 462, offsetMs: 4 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Violet Hellhound',
    rank: 'violet',
    level: 194,
    element: 'electricity',
    kills: { total: 213, today: 7, week: 34, month: 98, year: 213 },
    lastKillOffsetMs: 18 * 60 * 1000,
    sampleTtk: { lastMs: 55300, avgMs: 61400, count: 7, minMs: 45000, maxMs: 82000 },
    sampleDrops: [
      { itemName: 'Blessing of the Goddess', killCountAtDrop: 89, offsetMs: 3 * 24 * 60 * 60 * 1000 },
      { itemName: 'Scroll of XProtect', killCountAtDrop: 198, offsetMs: 8 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Chief Keokuk',
    rank: 'giant',
    level: 190,
    element: 'water',
    kills: { total: 341, today: 11, week: 52, month: 156, year: 341 },
    lastKillOffsetMs: 8 * 60 * 1000,
    sampleTtk: { lastMs: 38700, avgMs: 43100, count: 11, minMs: 31000, maxMs: 58000 },
    sampleDrops: [
      { itemName: 'Moonstone', killCountAtDrop: 167, offsetMs: 4 * 24 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Giant Taiaha',
    rank: 'giant',
    level: 188,
    element: 'wind',
    kills: { total: 156, today: 4, week: 22, month: 68, year: 156 },
    lastKillOffsetMs: 42 * 60 * 1000,
    sampleTtk: { lastMs: 52100, avgMs: 56800, count: 4, minMs: 44000, maxMs: 72000 },
    sampleDrops: []
  },
  {
    name: 'Violet Kanonicus',
    rank: 'violet',
    level: 182,
    element: 'fire',
    kills: { total: 278, today: 9, week: 41, month: 132, year: 278 },
    lastKillOffsetMs: 12 * 60 * 1000,
    sampleTtk: { lastMs: 33200, avgMs: 37500, count: 9, minMs: 27000, maxMs: 49000 },
    sampleDrops: [
      { itemName: 'Sunstone', killCountAtDrop: 64, offsetMs: 6 * 24 * 60 * 60 * 1000 },
      { itemName: 'Angel Blessing', killCountAtDrop: 145, offsetMs: 3 * 24 * 60 * 60 * 1000 },
      { itemName: 'Sunstone', killCountAtDrop: 241, offsetMs: 1 * 24 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Giant Kyouchish',
    rank: 'giant',
    level: 176,
    element: 'earth',
    kills: { total: 89, today: 2, week: 11, month: 37, year: 89 },
    lastKillOffsetMs: 2.5 * 60 * 60 * 1000,
    sampleTtk: { lastMs: 28900, avgMs: 31200, count: 2, minMs: 25000, maxMs: 38000 },
    sampleDrops: [
      { itemName: 'Twinkle Stone', killCountAtDrop: 53, offsetMs: 5 * 24 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Violet Samoset',
    rank: 'violet',
    level: 174,
    element: 'wind',
    kills: { total: 64, today: 0, week: 8, month: 27, year: 64 },
    lastKillOffsetMs: 1.5 * 24 * 60 * 60 * 1000,
    sampleTtk: null,
    sampleDrops: []
  },
  {
    name: 'Giant Hundur Sharpfoot',
    rank: 'giant',
    level: 168,
    element: 'electricity',
    kills: { total: 192, today: 6, week: 29, month: 85, year: 192 },
    lastKillOffsetMs: 22 * 60 * 1000,
    sampleTtk: { lastMs: 24800, avgMs: 27600, count: 6, minMs: 19000, maxMs: 35000 },
    sampleDrops: [
      { itemName: 'Moonstone', killCountAtDrop: 78, offsetMs: 7 * 24 * 60 * 60 * 1000 },
      { itemName: 'Vigor Ring', killCountAtDrop: 163, offsetMs: 2 * 24 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Clockworks',
    rank: 'boss',
    level: 120,
    element: 'fire',
    kills: { total: 28, today: 0, week: 2, month: 6, year: 28 },
    lastKillOffsetMs: 1 * 24 * 60 * 60 * 1000,
    sampleTtk: { lastMs: 295000, avgMs: 320000, count: 2, minMs: 270000, maxMs: 385000 },
    sampleDrops: [
      { itemName: 'Demol Earring', killCountAtDrop: 12, offsetMs: 14 * 24 * 60 * 60 * 1000 },
      { itemName: 'Crystal Sword', killCountAtDrop: 25, offsetMs: 2 * 24 * 60 * 60 * 1000 }
    ]
  },
  {
    name: 'Meteonyker',
    rank: 'boss',
    level: 140,
    element: 'electricity',
    kills: { total: 15, today: 0, week: 1, month: 3, year: 15 },
    lastKillOffsetMs: 2 * 24 * 60 * 60 * 1000,
    sampleTtk: { lastMs: 510000, avgMs: 480000, count: 1, minMs: 420000, maxMs: 540000 },
    sampleDrops: [
      { itemName: 'Ancient Emerald', killCountAtDrop: 8, offsetMs: 20 * 24 * 60 * 60 * 1000 }
    ]
  }
];

function buildGiantTrackerSamples(dropLogs, iconsBasePath) {
  const now = Date.now();
  return GIANT_TRACKER_SAMPLE_ROWS.map((sample) => {
    const ref = findMonsterByName(sample.name);
    const monsterId = ref?.id || null;
    const detail = monsterId ? loadMonsterDetails(monsterId) : null;
    const icon = detail?.icon || null;
    const iconUrl = icon ? `file:///${iconsBasePath}/${icon}` : null;

    // Use persisted drops if available, otherwise generate from sample data
    let drops = Array.isArray(dropLogs?.[sample.name]) ? dropLogs[sample.name] : [];
    if (drops.length === 0 && Array.isArray(sample.sampleDrops) && sample.sampleDrops.length > 0) {
      drops = sample.sampleDrops.map(sd => ({
        timestamp: now - sd.offsetMs,
        itemId: null,
        itemName: sd.itemName,
        killCountAtDrop: sd.killCountAtDrop
      }));
    }

    const dropStats = computeDropStats(sample.kills.total, drops);
    const lootPool = monsterId ? loadGiantLootPool(monsterId) : [];

    return {
      name: sample.name,
      rank: sample.rank,
      monsterId,
      level: ref?.level || sample.level || null,
      element: ref?.element || sample.element || null,
      iconUrl,
      hp: detail?.hp || null,
      minAttack: detail?.minAttack || null,
      maxAttack: detail?.maxAttack || null,
      kills: { ...sample.kills },
      lastKillTime: now - sample.lastKillOffsetMs,
      drops,
      killsSinceLastDrop: dropStats.killsSinceLastDrop,
      avgKillsPerDrop: dropStats.avgKillsPerDrop,
      lootPool,
      ttk: sample.sampleTtk || null
    };
  });
}

function aggregateGiantKills(profileId) {
  const now = Date.now();
  const cached = giantKillsCache.get(profileId);
  if (cached && (now - cached.timestamp) < 5000) return cached.data;

  const { dailyDir } = getHistoryPaths(profileId);
  const today = new Date();
  const todayKey = getDayKey(now);

  // Calculate date ranges
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const weekStartKey = getDayKey(weekStart.getTime());
  const monthStartKey = getDayKey(monthStart.getTime());
  const yearStartKey = getDayKey(yearStart.getTime());

  // Aggregate kills per monster per time range
  const monsterKills = {}; // monsterName -> { today, week, month, year, total, lastKillTime, ttk }

  if (!fs.existsSync(dailyDir)) {
    const result = { monsterKills };
    giantKillsCache.set(profileId, { data: result, timestamp: now });
    return result;
  }

  const files = fs.readdirSync(dailyDir)
    .filter((name) => DAILY_HISTORY_FILE_RE.test(name))
    .sort();

  for (const fileName of files) {
    const fileDate = fileName.slice(0, 10);
    // Skip files before year start for performance
    if (fileDate < yearStartKey) continue;

    const filePath = path.join(dailyDir, fileName);
    const { rows } = readDailyCsvRows(filePath);
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i];
      const rank = normalizeMonsterRankValue(cols[DAILY_COL_INDEX.rank]);
      if (rank !== 'giant' && rank !== 'violet' && rank !== 'boss') continue;

      const name = cols[DAILY_COL_INDEX.monsterName] || 'Unknown';
      if (!monsterKills[name]) {
        monsterKills[name] = { today: 0, week: 0, month: 0, year: 0, total: 0, lastKillTime: null, ttk: { sum: 0, count: 0, min: Infinity, max: 0, lastMs: null } };
      }
      const mk = monsterKills[name];
      mk.year++;
      if (fileDate >= monthStartKey) mk.month++;
      if (fileDate >= weekStartKey) mk.week++;
      if (fileDate === todayKey) mk.today++;

      const ts = parseDisplayDateTime(cols[DAILY_COL_INDEX.dateTime], fileDate, i);
      if (ts && (!mk.lastKillTime || ts > mk.lastKillTime)) mk.lastKillTime = ts;

      // TTK aggregation
      const ttkRaw = cols[DAILY_COL_INDEX.ttkMs];
      if (ttkRaw != null && ttkRaw !== '') {
        const ttkVal = parseInt(ttkRaw, 10);
        if (Number.isFinite(ttkVal) && ttkVal > 0) {
          mk.ttk.sum += ttkVal;
          mk.ttk.count++;
          if (ttkVal < mk.ttk.min) mk.ttk.min = ttkVal;
          if (ttkVal > mk.ttk.max) mk.ttk.max = ttkVal;
          mk.ttk.lastMs = ttkVal;
        }
      }
    }
  }

  // Add total from state.monsters (includes older data)
  const result = { monsterKills };
  giantKillsCache.set(profileId, { data: result, timestamp: now });
  return result;
}

async function buildGiantTrackerState(profileId) {
  const engine = await getEngine(profileId);
  const state = engine.getState();
  const monsters = state?.monsters || {};
  const userData = app.getPath('userData');
  const iconsBasePath = path.join(userData, 'user', 'cache', 'monster', 'icons').replace(/\\/g, '/');
  const itemIconsBasePath = path.join(userData, 'user', 'cache', 'item', 'icons').replace(/\\/g, '/');

  // Get time-based kill data
  const agg = aggregateGiantKills(profileId);

  // Load drop logs
  let dropLogs = {};
  try {
    dropLogs = await ctx.services.storage.read(`gt-drops:${profileId}`) || {};
  } catch (_) {}

  const giants = [];
  for (const [name, info] of Object.entries(monsters)) {
    const rank = info.rank || 'unknown';
    if (rank !== 'giant' && rank !== 'violet' && rank !== 'boss') continue;

    // Look up monster reference
    const ref = findMonsterByName(name);
    const monsterId = ref?.id || null;
    const detail = monsterId ? loadMonsterDetails(monsterId) : null;
    const icon = detail?.icon || null;
    const iconUrl = icon ? `file:///${iconsBasePath}/${icon}` : null;

    // Time-based kills from aggregation
    const timeKills = agg.monsterKills[name] || { today: 0, week: 0, month: 0, year: 0 };

    // Drop data
    const monsterDrops = Array.isArray(dropLogs[name]) ? dropLogs[name] : [];
    const dropStats = computeDropStats(info.count || 0, monsterDrops);

    // Loot pool
    const lootPool = monsterId ? loadGiantLootPool(monsterId) : [];

    // TTK data from aggregation
    const rawTtk = timeKills.ttk;
    let ttk = null;
    if (rawTtk && rawTtk.count > 0) {
      ttk = {
        lastMs: rawTtk.lastMs,
        avgMs: Math.round(rawTtk.sum / rawTtk.count),
        count: rawTtk.count,
        minMs: rawTtk.min !== Infinity ? rawTtk.min : null,
        maxMs: rawTtk.max > 0 ? rawTtk.max : null
      };
    }

    giants.push({
      name,
      rank,
      monsterId,
      level: ref?.level || null,
      element: ref?.element || null,
      iconUrl,
      hp: detail?.hp || null,
      minAttack: detail?.minAttack || null,
      maxAttack: detail?.maxAttack || null,
      kills: {
        total: info.count || 0,
        today: timeKills.today,
        week: timeKills.week,
        month: timeKills.month,
        year: timeKills.year
      },
      lastKillTime: info.lastKillTime || timeKills.lastKillTime || null,
      drops: monsterDrops,
      killsSinceLastDrop: dropStats.killsSinceLastDrop,
      avgKillsPerDrop: dropStats.avgKillsPerDrop,
      lootPool,
      ttk
    });
  }

  if (giants.length === 0) {
    giants.push(...buildGiantTrackerSamples(dropLogs, iconsBasePath));
  }

  // Sort: most kills first
  giants.sort((a, b) => b.kills.total - a.kills.total);

  return {
    giants,
    iconsBasePath: `file:///${iconsBasePath}/`,
    itemIconsBasePath: `file:///${itemIconsBasePath}/`
  };
}

/**
 * Storage key helpers
 */
const STORAGE_KEYS = {
  CONFIG: 'config',
  state: (profileId) => `state:${profileId}`,
  layout: (profileId) => `layout:${profileId}`,
  history: (profileId) => `history:${profileId}`,
  best: (profileId) => `best:${profileId}`,
  charName: (profileId) => `charname:${profileId}`,
  leaderboardMessages: 'leaderboard:messages',
  startupId: 'startup:id'
};

/**
 * Get or create stats engine for a profile.
 * Uses a pending-promise guard to prevent concurrent creation race conditions.
 */
const engineInitPromises = new Map(); // profileId -> Promise
async function getEngine(profileId) {
  if (profileEngines.has(profileId)) {
    return profileEngines.get(profileId);
  }
  if (engineInitPromises.has(profileId)) {
    return engineInitPromises.get(profileId);
  }
  const initPromise = (async () => {
    const savedState = await ctx.services.storage.read(STORAGE_KEYS.state(profileId));
    const engine = createStatsEngine(config, savedState);
    engine.setConfig(config);
    engine.resetSession();
    profileEngines.set(profileId, engine);
    engineInitPromises.delete(profileId);
    return engine;
  })();
  engineInitPromises.set(profileId, initPromise);
  return initPromise;
}

/**
 * Get or create layout manager for a profile
 */
async function getLayout(profileId) {
  if (!profileLayouts.has(profileId)) {
    // Load layout from storage
    const savedLayout = await ctx.services.storage.read(STORAGE_KEYS.layout(profileId));
    const layout = createLayoutManager(async (layoutData) => {
      // Save callback
      await ctx.services.storage.write(STORAGE_KEYS.layout(profileId), layoutData);
    });
    if (savedLayout) {
      layout.setLayout(savedLayout);
    }
    profileLayouts.set(profileId, layout);
  }
  return profileLayouts.get(profileId);
}

/**
 * Save profile state to storage
 */
async function saveProfileState(profileId) {
  const engine = profileEngines.get(profileId);
  if (engine) {
    const state = engine.getState();
    await ctx.services.storage.write(STORAGE_KEYS.state(profileId), state);
  }
}

/**
 * Broadcast computed state to all UI windows
 */
async function buildStateSnapshot(profileId) {
  const engine = await getEngine(profileId);
  const layoutMgr = await getLayout(profileId);
  const computed = engine.compute();
  const supportRm = supportExpCache.get(profileId);

  return {
    profileId,
    stats: {
      ...computed,
      rmExp: supportRm?.value ?? null,
      rmExpUpdatedAt: supportRm?.updatedAt ?? null
    },
    layout: layoutMgr.getLayout()
  };
}

/**
 * Broadcast computed state to all UI windows.
 * Throttled to BROADCAST_INTERVAL_MS but guarantees the latest state
 * is always sent via a deferred broadcast when throttled.
 */
async function broadcastState(profileId) {
  const now = Date.now();
  const lastTime = lastBroadcast.get(profileId) || 0;

  // Throttle broadcasts — schedule deferred broadcast instead of discarding
  if (now - lastTime < BROADCAST_INTERVAL_MS) {
    if (!pendingBroadcast.has(profileId)) {
      const delay = BROADCAST_INTERVAL_MS - (now - lastTime);
      const timer = setTimeout(() => {
        pendingBroadcast.delete(profileId);
        broadcastState(profileId).catch(() => {});
      }, delay);
      pendingBroadcast.set(profileId, timer);
    }
    return;
  }

  // Clear any pending deferred broadcast since we're sending now
  const pending = pendingBroadcast.get(profileId);
  if (pending) {
    clearTimeout(pending);
    pendingBroadcast.delete(profileId);
  }

  lastBroadcast.set(profileId, now);

  try {
    const payload = await buildStateSnapshot(profileId);

    // Broadcast to all listeners
    ctx.ipc.broadcast('state:update', payload);
  } catch (err) {
    debugLog('ipc', `[Broadcast] failed for profile=${profileId}: ${err?.message || err}`);
  }
}

/**
 * Handle OCR tick event
 */
async function handleOcrUpdate(payload) {
  if (!config.enabled) {
    return;
  }

  // Serialize OCR updates per profile to prevent race conditions
  // when kills happen in rapid succession.
  const profileId = payload?.profileId;
  const key = profileId || '__global__';
  const prev = ocrLocks.get(key) || Promise.resolve();
  const next = prev.then(() => _handleOcrUpdateInner(payload)).catch((err) => {
    console.error('[Killfeed] handleOcrUpdate crashed (OCR pipeline preserved):', err);
  });
  ocrLocks.set(key, next);
  return next;
}

async function _handleOcrUpdateInner(payload) {
  const { profileId, values } = payload;
  const meta = payload && typeof payload === 'object' && payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
  const isManualExp = meta && meta.manualExp === true;
  if (!profileId || !values) {
    return;
  }

  // Track last active profile for sidepanel discovery
  if (profileId && profileId !== 'default') {
    lastActiveProfileId = profileId;
    sessionActiveProfiles.add(profileId);
  }

  const { lvl, exp, rmExp, charname, monsterName, enemyHp, updatedAt } = values;
  const tickTime = typeof updatedAt === 'number' ? updatedAt : Date.now();

  // Remember when a non-empty enemy HP bar was last seen
  if (typeof enemyHp === 'string' && enemyHp.trim()) {
    enemyHpSeenAt.set(profileId, tickTime);
  }

  // Parse enemy HP for TTK tracking
  const parsedHp = parseEnemyHp(enemyHp);

  // Convert OCR strings (e.g., "12.34%") into numeric values
  const parsedLvl = parseNumber(lvl);
  const parsedExp = parseNumber(exp);
  const parsedRmExp = parseNumber(rmExp);
  const monsterToken = typeof monsterName === 'string' ? monsterName : (typeof values?.enemyName === 'string' ? values.enemyName : null);
  const parsedMonster = monsterToken ? parseMonsterToken(monsterToken) : null;
  let monsterCandidate = null;

  // HP-first strategy: most reliable OCR signal for monster identification
  if (parsedHp && parsedHp.max > 0) {
    const hpRef = findMonsterByHp(
      parsedHp.max,
      parsedMonster ? parsedMonster.element : null,
      parsedMonster ? parsedMonster.level : null
    );
    if (hpRef) {
      monsterCandidate = {
        id: hpRef.id,
        name: hpRef.name,
        element: hpRef.element,
        level: hpRef.level,
        rank: hpRef.rank || null
      };
    }
  }

  // Fallback: level+element when HP is unavailable or didn't match
  if (!monsterCandidate && parsedMonster && parsedMonster.level && parsedMonster.element) {
    const ref = findMonsterByLevelElement(parsedMonster.level, parsedMonster.element);
    if (ref) {
      monsterCandidate = {
        id: ref.id,
        name: ref.name,
        element: ref.element,
        level: ref.level,
        rank: ref.rank || null
      };
    }
  }

  if (rmExp !== undefined) {
    supportExpCache.set(profileId, {
      value: parsedRmExp !== null ? parsedRmExp : rmExp,
      updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now()
    });
  }

  if (parsedLvl === null || parsedExp === null) {
    // Even if EXP parse failed, we may still want to broadcast rmExp updates
    await broadcastState(profileId);
    return;
  }

  // Get or create engine for this profile
  const engine = await getEngine(profileId);
  const state = engine.getState?.() || {};
  const effectiveLvl = parsedLvl !== null && parsedLvl !== undefined ? parsedLvl
    : (Number.isFinite(state.lastLvl) ? state.lastLvl : null);

  if (effectiveLvl === null) {
    // Still no level available; skip update but keep rmExp propagation above.
    await broadcastState(profileId);
    return;
  }

  if (isManualExp) {
    if (engine.applyManualExp && parsedExp !== null) {
      engine.applyManualExp(parsedExp, effectiveLvl, tickTime);
      await saveProfileState(profileId);
    }
    await broadcastState(profileId);
    return;
  }

  // Monster detail lookup for validation
  let monsterMeta = null;
  if (monsterCandidate && monsterCandidate.id) {
    const detail = loadMonsterDetails(monsterCandidate.id);
    const expectedExp = getExpectedExp(detail, effectiveLvl);
    monsterMeta = {
      ...monsterCandidate,
      expectedExp
    };
  }

  // If no monsterMeta yet but we have a resolved monster name, look up rank by name
  if (!monsterMeta && monsterToken && !parsedMonster) {
    const refByName = findMonsterByName(monsterToken);
    if (refByName) {
      const detail = loadMonsterDetails(refByName.id);
      const expectedExp = getExpectedExp(detail, effectiveLvl);
      monsterMeta = {
        id: refByName.id,
        name: refByName.name,
        element: refByName.element,
        level: refByName.level,
        rank: refByName.rank || null,
        expectedExp
      };
    }
  }

  // Resolve monster name: prefer current OCR data, fall back to last known
  // monster within a grace window (enemy may have disappeared before EXP tick).
  const MONSTER_GRACE_MS = 2000;
  let resolvedMonsterName = (monsterMeta && monsterMeta.name) || monsterName || null;
  let resolvedMonsterMeta = monsterMeta;

  if (!resolvedMonsterName) {
    const last = lastKnownMonster.get(profileId);
    if (last && (tickTime - last.timestamp) <= MONSTER_GRACE_MS) {
      resolvedMonsterName = last.name;
      if (!resolvedMonsterMeta && last.meta) {
        resolvedMonsterMeta = last.meta;
      }
    }
  }

  // Update last known monster when we have a valid name
  if (resolvedMonsterName && resolvedMonsterName.trim()) {
    lastKnownMonster.set(profileId, {
      name: resolvedMonsterName,
      meta: resolvedMonsterMeta,
      timestamp: tickTime
    });
  }

  // Update TTK tracker with parsed HP data (giants/violets only)
  updateTtkTracker(profileId, parsedHp, resolvedMonsterName, resolvedMonsterMeta?.rank, tickTime);

  // Process the OCR tick with the raw OCR value (no smoothing) so currentExp mirrors live OCR.
  const expValue = parsedExp;
  const _prevState = engine.getState();
  const _prevLvl = _prevState.lastLvl;
  const _prevExp = _prevState.lastExp;
  const _hpSeen = enemyHpSeenAt.get(profileId);
  const _hpAge = typeof _hpSeen === 'number' ? (tickTime - _hpSeen) : null;
  debugLog('ocr', `[OCR] PRE-UPDATE profile=${profileId} lvl=${effectiveLvl} exp=${expValue} prevLvl=${_prevLvl} prevExp=${_prevExp} deltaExp=${_prevExp !== null ? (expValue - _prevExp).toFixed(6) : 'N/A'} hpAge=${_hpAge !== null ? _hpAge + 'ms' : 'none'} hpWindow=${config.killHpWindowMs}ms lastKillTime=${_prevState.lastKillTime}`);
  let killEvent = engine.update(
    effectiveLvl,
    expValue,
    charname,
    resolvedMonsterName,
    tickTime,
    expValue,
    enemyHpSeenAt.get(profileId),
    resolvedMonsterMeta,
    (deltaExp, meta) => {
      if (!meta || !meta.expectedExp || !Number.isFinite(meta.expectedExp)) {
        return true;
      }
      const expected = Number(meta.expectedExp);
      const min = expected * 0.1;
      const max = expected * 10;
      return deltaExp >= min && deltaExp <= max;
    }
  );

  if (!killEvent && _prevExp !== null) {
    const _delta = expValue - _prevExp;
    const _hpWindowMs = typeof config.killHpWindowMs === 'number' ? config.killHpWindowMs : 1500;
    const _hasRecentHp = typeof _hpSeen === 'number' && (tickTime - _hpSeen) <= _hpWindowMs;
    const _timeSinceKill = _prevState.lastKillTime ? tickTime - _prevState.lastKillTime : Infinity;
    const _fallbackMs = Math.max(2000, _hpWindowMs * 1.5);
    const _allowNoHp = !_hasRecentHp && _timeSinceKill >= _fallbackMs;
    let _reason = 'unknown';
    if (_delta <= 0) _reason = `deltaExp<=0 (${_delta.toFixed(6)})`;
    else if (_delta <= config.epsilon) _reason = `deltaExp(${_delta.toFixed(6)}) <= epsilon(${config.epsilon})`;
    else if (!_hasRecentHp && !_allowNoHp) _reason = `no HP bar: hpAge=${_hpAge}ms window=${_hpWindowMs}ms timeSinceKill=${_timeSinceKill}ms fallback=${_fallbackMs}ms`;
    else if (_delta > config.suspectThreshold) _reason = `suspect: deltaExp(${_delta.toFixed(4)}) > threshold(${config.suspectThreshold})`;
    else _reason = `killValidator rejected or other`;
    debugLog('ocr', `[OCR] NO KILL profile=${profileId}: reason=${_reason}`);
  }

  // Broadcast IMMEDIATELY so the UI reflects the kill (or updated EXP) without
  // waiting for post-validation I/O. This is the critical path for responsiveness.
  await broadcastState(profileId);

  // Post-validation and persistence happen after the UI is already updated.
  // With pre-loaded monster tables, isWithinAllowed is a pure in-memory lookup (< 1ms).
  if (killEvent) {
    try {
      const within = await monsterExpValidator.isWithinAllowed(
        killEvent.monsterName || resolvedMonsterName || '',
        effectiveLvl,
        killEvent.deltaExp
      );
      if (within === false) {
        console.warn(`[Killfeed] KILL ROLLED BACK: monster=${killEvent.monsterName || resolvedMonsterName || "?"} lvl=${effectiveLvl} deltaExp=${killEvent.deltaExp.toFixed?.(4) ?? killEvent.deltaExp}`);
        // Rollback the state mutation that registerKill() already performed
        engine.rollbackLastKill();
        killEvent = null;
        // Force a correction broadcast (reset throttle so it goes through)
        lastBroadcast.delete(profileId);
        await broadcastState(profileId);
      }
    } catch (err) {
      debugLog('ocr', `[OCR] monster EXP validation failed: ${err?.message || err}`);
    }
  }

  if (killEvent) {
    // Complete TTK measurement for this kill
    const ttkMs = completeTtk(profileId);
    debugLog('ocr', `[OCR] kill detected profile=${profileId} deltaExp=${killEvent.deltaExp} killsSession=${engine.getState().killsSession ?? "?"} ttkMs=${ttkMs ?? 'none'}`);

    // Kill in CSV-History schreiben
    appendKillToHistory(profileId, {
      timestamp: killEvent.timestamp,
      playerLevel: effectiveLvl,
      charName: charname || '',
      monsterName: killEvent.monsterName || '',
      monsterId: resolvedMonsterMeta?.id || '',
      monsterLevel: resolvedMonsterMeta?.level ?? '',
      monsterElement: resolvedMonsterMeta?.element || '',
      monsterRank: killEvent.rank || '',
      deltaExp: killEvent.deltaExp,
      expectedExp: resolvedMonsterMeta?.expectedExp ?? '',
      ttkMs: ttkMs
    });

    // Invalidate giant tracker cache on kill
    giantKillsCache.delete(profileId);

    ctx.eventBus.emit('kill-registered', {
      profileId,
      ...killEvent
    });
  }

  // Persist state in background (non-blocking for the OCR pipeline)
  saveProfileState(profileId).catch(err => {
    ctx.logger.error(`Failed to save state for profile ${profileId}: ${err.message}`);
  });
}

/**
 * LIFECYCLE: init
 * Called once when plugin loads. Register IPC handlers and load config.
 */
async function init(context) {
  ctx = context;
  pluginDir = context.pluginDir || null;
  console.log('[Killfeed] init: pluginDir =', pluginDir);

  loadDebugConfig();
  loadMonsterReference();
  console.log('[Killfeed] init: monsterReference.length =', monsterReference.length);

  monsterExpValidator.init(app.getPath('userData'));
  // Eagerly pre-load all monster EXP tables in background so kill
  // validation is instant (pure in-memory Map lookup) from the first kill.
  monsterExpValidator.preloadAll().catch(err => {
    console.log('[Killfeed] monster EXP preload failed (non-fatal):', err?.message || err);
  });

  // Load config from storage or use defaults
  const savedConfig = await ctx.services.storage.read(STORAGE_KEYS.CONFIG);
  config = schema.migrateConfig(savedConfig);
  await loadLeaderboardMessages();

  debugLog('lifecycle', 'Killfeed plugin initializing...');

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('cfg:get', async () => {
    return config;
  });

  ctx.ipc.handle('cfg:set', async (_event, newConfig) => {
    const merged = schema.mergeWithDefaults(newConfig, config);
    const validation = schema.validateConfig(merged);

    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    config = merged;
    await ctx.services.storage.write(STORAGE_KEYS.CONFIG, config);

    // Update all engines with new config
    for (const engine of profileEngines.values()) {
      engine.setConfig(config);
    }

    return { success: true };
  });

  ctx.ipc.handle('cfg:reset', async () => {
    config = schema.getDefaultConfig();
    await ctx.services.storage.write(STORAGE_KEYS.CONFIG, config);

    // Update all engines with new config
    for (const engine of profileEngines.values()) {
      engine.setConfig(config);
    }

    return { success: true, config };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OVERLAY IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  // DISCORD IPC HANDLERS
  ctx.ipc.handle('discord:publish', async (_event, profileId) => {
    const targetProfile = typeof profileId === 'string' && profileId ? profileId : 'default';
    return publishDiscordLeaderboard(targetProfile);
  });

  // CHARACTER NAME IPC
  ctx.ipc.handle('char:get', async (_event, profileId) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    const value = await getCharacterName(pid);
    return { success: true, charName: value };
  });

  ctx.ipc.handle('char:set', async (_event, profileId, name) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    const saved = await setCharacterName(pid, name);
    return { success: true, charName: saved };
  });

  ctx.ipc.handle('overlay:bind', async (_event, browserViewId, profileId) => {
    // Store mapping - actual window creation depends on host capabilities
    debugLog('ipc',
      `Overlay bind: browserView=${typeof browserViewId}:${JSON.stringify(browserViewId)}, profile=${typeof profileId}:${JSON.stringify(profileId)}`
    );

    // Initialize engine and layout for this profile
    await getEngine(profileId);
    await getLayout(profileId);

    return { success: true };
  });

  ctx.ipc.handle('overlay:toggle:all', async (_event, profileId) => {
    const layoutMgr = await getLayout(profileId);
    const newState = layoutMgr.toggleOverlay();

    ctx.ipc.broadcast('vis:update', {
      profileId,
      overlayVisible: newState,
      visibility: layoutMgr.getVisibility()
    });

    return { success: true, overlayVisible: newState };
  });

  ctx.ipc.handle('overlay:request:state', async (_event, profileId) => {
    const snapshot = await buildStateSnapshot(profileId);
    const charName = await getCharacterName(profileId);

    return {
      stats: snapshot.stats,
      layout: snapshot.layout,
      charName
    };
  });

  ctx.ipc.handle('session:reset', async (_event, profileId) => {
    await evaluateAndPublishProfile(profileId, 'reset');
    const engine = await getEngine(profileId);
    engine.resetSession();
    await saveProfileState(profileId);
    await broadcastState(profileId);
    return { success: true };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PANEL IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('panel:bind:profile', async (_event, profileId) => {
    debugLog('ipc',
      `Panel bind: profile=${typeof profileId}:${JSON.stringify(profileId)}`
    );

    // Initialize engine and layout for this profile
    await getEngine(profileId);
    await getLayout(profileId);
    await getCharacterName(profileId);

    return { success: true };
  });

  ctx.ipc.handle('panel:get:active-profile', async () => {
    // Sidepanel should follow the configured overlay target profile.
    const overlayTargetId = await getOverlayTargetProfileId();
    if (overlayTargetId) {
      await getEngine(overlayTargetId);
      await getLayout(overlayTargetId);
      return { profileId: overlayTargetId, profiles: [overlayTargetId] };
    }

    const profiles = [...profileEngines.keys()].filter(p => p !== 'default' && p !== 'overlay-host');

    // Fallback: prefer the profile that most recently received OCR events
    if (lastActiveProfileId && profileEngines.has(lastActiveProfileId)) {
      return { profileId: lastActiveProfileId, profiles };
    }

    // Fallback: pick from session-active profiles only, prefer most session kills
    let bestId = null;
    let bestSessionKills = -1;
    for (const [pid, engine] of profileEngines.entries()) {
      if (pid === 'default' || pid === 'overlay-host') continue;
      if (sessionActiveProfiles.size > 0 && !sessionActiveProfiles.has(pid)) continue;
      const st = engine.getState();
      const sk = st ? (st.killsSession || 0) : 0;
      if (sk > bestSessionKills) {
        bestSessionKills = sk;
        bestId = pid;
      }
    }
    return { profileId: bestId, profiles };
  });

  ctx.ipc.handle('panel:request:state', async (_event, profileId) => {
    const snapshot = await buildStateSnapshot(profileId);
    const charName = await getCharacterName(profileId);

    return {
      stats: snapshot.stats,
      layout: snapshot.layout,
      charName
    };
  });
  ctx.ipc.handle('history:list:kills', async (_event, profileId, rank) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    const kills = await listHistoryKills(pid, rank);
    return { success: true, kills };
  });

  ctx.ipc.handle('history:delete:kill', async (_event, profileId, payload) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    return deleteHistoryKill(pid, payload);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GIANT TRACKER IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('gt:open', async () => {
    openGiantTrackerWindow();
    return { success: true };
  });

  ctx.ipc.handle('gt:request:state', async (_event, profileId) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    await getEngine(pid);
    return buildGiantTrackerState(pid);
  });

  ctx.ipc.handle('gt:log:drop', async (_event, profileId, monsterName, itemId, itemName) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    const key = `gt-drops:${pid}`;
    const drops = await ctx.services.storage.read(key) || {};
    if (!drops[monsterName]) drops[monsterName] = [];
    const engine = profileEngines.get(pid);
    const state = engine?.getState?.();
    const sample = GIANT_TRACKER_SAMPLE_ROWS.find((row) => row.name === monsterName);
    const killCount = state?.monsters?.[monsterName]?.count || sample?.kills?.total || 0;
    drops[monsterName].push({
      timestamp: Date.now(),
      itemId,
      itemName,
      killCountAtDrop: killCount
    });
    await ctx.services.storage.write(key, drops);
    return { success: true };
  });

  ctx.ipc.handle('gt:delete:drop', async (_event, profileId, monsterName, dropIndex) => {
    const pid = typeof profileId === 'string' && profileId ? profileId : 'default';
    const key = `gt-drops:${pid}`;
    const drops = await ctx.services.storage.read(key) || {};
    if (!drops[monsterName] || !Array.isArray(drops[monsterName])) {
      return { success: false, error: 'no-drops' };
    }
    const idx = Number(dropIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= drops[monsterName].length) {
      return { success: false, error: 'invalid-index' };
    }
    drops[monsterName].splice(idx, 1);
    if (drops[monsterName].length === 0) delete drops[monsterName];
    await ctx.services.storage.write(key, drops);
    return { success: true };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VISIBILITY IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('vis:set', async (_event, profileId, badgeKey, visible) => {
    const layoutMgr = await getLayout(profileId);
    layoutMgr.setBadgeVisibility(badgeKey, visible);

    ctx.ipc.broadcast('vis:update', {
      profileId,
      overlayVisible: layoutMgr.isOverlayVisible(),
      visibility: layoutMgr.getVisibility()
    });

    return { success: true };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('layout:set', async (_event, profileId, layoutObj) => {
    const layoutMgr = await getLayout(profileId);

    if (layoutObj.order) {
      layoutMgr.setOrder(layoutObj.order);
    }
    if (layoutObj.visibility) {
      layoutMgr.setAllVisibility(layoutObj.visibility);
    }
    if (layoutObj.overlayVisible !== undefined) {
      layoutMgr.setOverlayVisible(layoutObj.overlayVisible);
    }
    if (layoutObj.rows !== undefined) {
      layoutMgr.setRows(layoutObj.rows);
    }
    if (layoutObj.scale !== undefined) {
      layoutMgr.setScale(layoutObj.scale);
    }

    ctx.ipc.broadcast('layout:update', {
      profileId,
      layout: layoutMgr.getLayout()
    });

    return { success: true };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEBUG IPC HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  ctx.ipc.handle('debug:dump:state', async (_event, profileId) => {
    if (!profileId) {
      // Dump all profiles
      const dump = {
        config,
        profiles: {}
      };

      for (const [pid, engine] of profileEngines.entries()) {
        const layoutMgr = profileLayouts.get(pid);
        dump.profiles[pid] = {
          state: engine.getState(),
          computed: engine.compute(),
          layout: layoutMgr ? layoutMgr.getLayout() : null
        };
      }

      return dump;
    }

    const engine = await getEngine(profileId);
    const layoutMgr = await getLayout(profileId);

    return {
      state: engine.getState(),
      computed: engine.compute(),
      layout: layoutMgr.getLayout()
    };
  });

  debugLog('lifecycle', 'Killfeed plugin initialized');
}

/**
 * LIFECYCLE: start
 * Called when plugin becomes active. Subscribe to events and start processing.
 */
async function start(context) {
  ctx = context;

  debugLog('lifecycle', 'Killfeed plugin starting...');

  // Startup ID posting disabled
  // await postStartupIdToDiscord();

  // Subscribe to OCR updates from the core
  unsubscribeOcr = ctx.eventBus.on('core:ocr:update', handleOcrUpdate);

  try {
    const profileIds = await discoverProfileIds();
    await publishRecordsForProfiles(profileIds, 'startup');
  } catch (err) {
    ctx.logger.warn(`Startup leaderboard publish failed: ${err.message}`);
  }

  debugLog('lifecycle', 'Killfeed plugin started - listening for OCR events');
}

/**
 * LIFECYCLE: stop
 * Called when plugin is deactivated. Clean up resources.
 */
async function stop() {
  debugLog('lifecycle', 'Killfeed plugin stopping...');

  try {
    const profileIds = Array.from(profileEngines.keys());
    await publishRecordsForProfiles(profileIds, 'shutdown');
  } catch (err) {
    ctx.logger.warn(`Shutdown leaderboard publish failed: ${err.message}`);
  }

  // Close Giant Tracker window
  if (giantTrackerWindow && !giantTrackerWindow.isDestroyed()) {
    giantTrackerWindow.close();
    giantTrackerWindow = null;
  }

  // Unsubscribe from events
  if (unsubscribeOcr) {
    unsubscribeOcr();
    unsubscribeOcr = null;
  }

  // Save all profile states
  for (const [profileId, engine] of profileEngines.entries()) {
    try {
      const state = engine.getState();
      await ctx.services.storage.write(STORAGE_KEYS.state(profileId), state);
    } catch (err) {
      ctx.logger.error(`Failed to save state for profile ${profileId}: ${err.message}`);
    }
  }

  // Clear maps
  profileEngines.clear();
  profileLayouts.clear();
  overlayWindows.clear();
  lastBroadcast.clear();
  for (const timer of pendingBroadcast.values()) clearTimeout(timer);
  pendingBroadcast.clear();
  ocrLocks.clear();
  lastKnownMonster.clear();
  monsterDetailsCache.clear();
  monsterReference.length = 0;
  enemyHpSeenAt.clear();
  expSamples.clear();
  supportExpCache.clear();
  giantKillsCache.clear();
  itemDetailsCache.clear();

  debugLog('lifecycle', 'Killfeed plugin stopped');
}

module.exports = {
  init,
  start,
  stop
};
