/**
 * Killfeed Plugin - Main Entry Point
 * Lifecycle management, IPC handlers, and OCR event processing.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
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

// Event unsubscribe functions
let unsubscribeOcr = null;

// Throttle state for broadcasts
const lastBroadcast = new Map(); // profileId -> timestamp
const BROADCAST_INTERVAL_MS = 200; // Max 5 updates/sec
const DISCORD_EMBED_COLOR = 0x5865f2;
const STATE_KEY_PREFIX = 'state:';

// Track last time an enemy HP bar was seen per profile
const enemyHpSeenAt = new Map();

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

    const DAILY_HEADER = 'Datum\tCharakter\tLevel\tMonster-ID\tRang\tMonster\tElement\tEXP Zuwachs\tErwartete EXP\n';

    const row = [
      `${dateStr} ${timeStr}`,
      esc(killData.charName ?? ''),
      killData.playerLevel ?? '',
      esc(killData.monsterId ?? ''),
      esc(killData.monsterRank ?? ''),
      esc(killData.monsterName ?? ''),
      esc(killData.monsterElement ?? ''),
      formatExpValue(killData.deltaExp),
      formatExpValue(killData.expectedExp)
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
 * Broadcast computed state to all UI windows
 */
async function broadcastState(profileId) {
  const now = Date.now();
  const lastTime = lastBroadcast.get(profileId) || 0;

  // Throttle broadcasts
  if (now - lastTime < BROADCAST_INTERVAL_MS) {
    return;
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

  // Convert OCR strings (e.g., "12.34%") into numeric values
  const parsedLvl = parseNumber(lvl);
  const parsedExp = parseNumber(exp);
  const parsedRmExp = parseNumber(rmExp);
  const monsterToken = typeof monsterName === 'string' ? monsterName : (typeof values?.enemyName === 'string' ? values.enemyName : null);
  const parsedMonster = monsterToken ? parseMonsterToken(monsterToken) : null;
  let monsterCandidate = null;
  if (parsedMonster && parsedMonster.level && parsedMonster.element) {
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
  const MONSTER_GRACE_MS = 5000;
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
    debugLog('ocr', `[OCR] kill detected profile=${profileId} deltaExp=${killEvent.deltaExp} killsSession=${engine.getState().killsSession ?? "?"}`);

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
      expectedExp: resolvedMonsterMeta?.expectedExp ?? ''
    });

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
  lastKnownMonster.clear();
  monsterDetailsCache.clear();
  monsterReference.length = 0;
  enemyHpSeenAt.clear();
  expSamples.clear();
  supportExpCache.clear();

  debugLog('lifecycle', 'Killfeed plugin stopped');
}

module.exports = {
  init,
  start,
  stop
};
