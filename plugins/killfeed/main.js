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

// Debug configuration
let debugConfig = {
  enabled: false,
  ocr: false,
  lifecycle: false,
  ipc: false,
  discord: false
};

function loadDebugConfig() {
  try {
    const configPath = path.join(__dirname, 'debugConfig.json');
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

// Load debug config immediately
loadDebugConfig();
function loadMonsterReference() {
  const candidates = [
    path.join(app.getPath('userData'), 'monster_reference.json'),
    path.join(__dirname, 'monster_reference.json'),
    path.join(__dirname, '..', 'monster_reference.json'),
    path.join(__dirname, '..', '..', 'monster_reference.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        monsterReference.length = 0;
        if (Array.isArray(data)) {
          data.forEach((row) => monsterReference.push(row));
        }
        debugLog('lifecycle', '[MonsterRef] geladen aus', p, 'Einträge:', monsterReference.length);
        return;
      }
    } catch (err) {
      debugLog('lifecycle', '[MonsterRef] Fehler beim Laden', p, err?.message || err);
    }
  }
  debugLog('lifecycle', '[MonsterRef] keine Referenz gefunden');
}

loadMonsterReference();

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
const monsterReference = [];
const monsterDetailsCache = new Map(); // id -> parsed json

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
  const filePath = path.join(app.getPath('userData'), 'api_fetch', 'monster', 'monster_parameter', `${monsterId}.json`);
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

async function postStartupIdToDiscord() {
  if (!ctx?.services?.http?.fetch) return;
  const startupId = await getStartupId();
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
 * Get or create stats engine for a profile
 */
async function getEngine(profileId) {
  if (!profileEngines.has(profileId)) {
    // Load state from storage
    const savedState = await ctx.services.storage.read(STORAGE_KEYS.state(profileId));
    const engine = createStatsEngine(config, savedState);
    engine.setConfig(config);
    // Start fresh session counters on plugin start, keep lifetime totals
    engine.resetSession();
    profileEngines.set(profileId, engine);
  }
  return profileEngines.get(profileId);
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
async function broadcastState(profileId) {
  const now = Date.now();
  const lastTime = lastBroadcast.get(profileId) || 0;

  // Throttle broadcasts
  if (now - lastTime < BROADCAST_INTERVAL_MS) {
    return;
  }
  lastBroadcast.set(profileId, now);

  const engine = await getEngine(profileId);
  const layoutMgr = await getLayout(profileId);

  const computed = engine.compute();
  const supportRm = supportExpCache.get(profileId);
  const mergedStats = {
    ...computed,
    rmExp: supportRm?.value ?? null,
    rmExpUpdatedAt: supportRm?.updatedAt ?? null
  };
  const layout = layoutMgr.getLayout();

  const payload = {
    profileId,
    stats: mergedStats,
    layout
  };

  // Broadcast to all listeners
  ctx.ipc.broadcast('state:update', payload);
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
        level: ref.level
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

  // Process the OCR tick with the raw OCR value (no smoothing) so currentExp mirrors live OCR.
  const expValue = parsedExp;
  let killEvent = engine.update(
    effectiveLvl,
    expValue,
    charname,
    (monsterMeta && monsterMeta.name) || monsterName || null,
    tickTime,
    expValue,
    enemyHpSeenAt.get(profileId),
    monsterMeta,
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

  // If a kill was detected, save state and emit event
  if (killEvent) {
    try {
      const within = await monsterExpValidator.isWithinAllowed(
        killEvent.monsterName || monsterName || '',
        effectiveLvl,
        killEvent.deltaExp
      );
      if (within === false) {
        debugLog('ocr', `[OCR] kill dropped by EXP table monster=${killEvent.monsterName || monsterName || "?"} lvl=${effectiveLvl} deltaExp=${killEvent.deltaExp.toFixed?.(4) ?? killEvent.deltaExp}`);
        killEvent = null;
      }
    } catch (err) {
      debugLog('ocr', `[OCR] monster EXP validation failed: ${err?.message || err}`);
    }
  }

  if (killEvent) {
    debugLog('ocr',
      `[OCR] kill detected profile=${profileId} deltaExp=${killEvent.deltaExp} killsSession=${engine.getState().killsSession + 1 ?? "?"}`
    );
    await saveProfileState(profileId);
    ctx.eventBus.emit('kill-registered', {
      profileId,
      ...killEvent
    });
  }

  // Broadcast updated state to UI
  await broadcastState(profileId);
}

/**
 * LIFECYCLE: init
 * Called once when plugin loads. Register IPC handlers and load config.
 */
async function init(context) {
  ctx = context;
  monsterExpValidator.init(app.getPath('userData'));

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

  ctx.ipc.handle('cfg:set', async (newConfig) => {
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
    const engine = await getEngine(profileId);
    const layoutMgr = await getLayout(profileId);
    const charName = await getCharacterName(profileId);

    return {
      stats: engine.compute(),
      layout: layoutMgr.getLayout(),
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

  ctx.ipc.handle('panel:request:state', async (_event, profileId) => {
    const engine = await getEngine(profileId);
    const layoutMgr = await getLayout(profileId);
    const charName = await getCharacterName(profileId);

    return {
      stats: engine.compute(),
      layout: layoutMgr.getLayout(),
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

  ctx.ipc.handle('debug:dump:state', async (profileId) => {
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

  // Generate or load persistent startup id and post it to Discord
  await postStartupIdToDiscord();

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

  debugLog('lifecycle', 'Killfeed plugin stopped');
}

module.exports = {
  init,
  start,
  stop
};
