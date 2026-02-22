/**
 * Killfeed Plugin - Schema & Configuration
 * Defines config defaults, badge keys, validation, and data structures.
 */

const SCHEMA_VERSION = 1;
const PLUGIN_VERSION = '2.0.1';

// All available badge keys
const BADGE_KEYS = [
  'killsSession',
  'killsTotal',
  'killsPerHour',
  'killsPerMin',
  'expLastKill',
  'expTotal',
  'expPerHour',
  'expPerMin',
  'killsToLevel',
  'sessionDuration',
  'expSession',
  'currentExp',
  'rmExp',
  'avgTimePerKill',
  'timeSinceLastKill',
  'last3Kills',
  'resetSession'
];

// Badge display labels (for UI)
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

// Monster rank categories
const MONSTER_RANKS = {
  NORMAL: 'normal',
  GIANT: 'giant',
  VIOLET: 'violet',
  BOSS: 'boss',
  UNKNOWN: 'unknown'
};

// Persist mode options
const PERSIST_MODES = {
  NONE: 'none',
  JSON: 'json',
  CSV: 'csv'
};

// Default global configuration
function getDefaultConfig() {
  return {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    enabled: true,
    // Require a recent enemy HP bar around EXP gains to count a kill
    killHpWindowMs: 1500,
    allowDiscordLeaderboard: false,
    discordWebhookUrl: '',
    discordServerName: '',
    discordPlayerName: '',
    leaderboardWebhooks: {
      killsTotal: '',
      killsSession: '',
      killsPerHour: '',
      killsPerMin: '',
      expTotal: '',
      expPerHour: '',
      expPerMin: '',
      expSession: '',
      avgKillTime: ''
    },
    persistMode: PERSIST_MODES.NONE,
    epsilon: 0.001,
    rollingWindowSec: 300,
    minDelta: 0.01,
    suspectThreshold: 40.0 // Treat exp jumps > 40% as suspect
  };
}

// Default badge visibility (all visible by default)
function getDefaultBadgeVisibility() {
  const visibility = {};
  for (const key of BADGE_KEYS) {
    visibility[key] = key === 'resetSession' ? false : true;
  }
  return visibility;
}

// Default layout (badge order and positions)
function getDefaultLayout() {
  return {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    order: [...BADGE_KEYS],
    positions: {}, // badgeKey -> {x, y} if custom positioned
    visibility: getDefaultBadgeVisibility(),
    overlayVisible: true,
    rows: 2,
    scale: 1
  };
}

// Default profile state
function getDefaultProfileState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion: PLUGIN_VERSION,
    // Session stats (reset on session start)
    killsSession: 0,
    expSession: 0,
    sessionStartTime: null,
  // Persistent totals
  killsTotal: 0,
  expTotal: 0,
  expTotalDay: null,
  // Rolling window data
  rollingKills: [], // {timestamp, deltaExp}
  // Last 3 kills for average calculation
  last3Kills: [], // {monsterName, deltaExp, timestamp}
  // Current state
    lastLvl: null,
    lastExp: null,
    lastExpRaw: null,
    lastUpdateTime: null,
    lastKillTime: null,
    // Monster tracking
    monsters: {} // monsterName -> {count, rank, lastKillTime}
  };
}

// Validate config object
function validateConfig(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (typeof config.allowDiscordLeaderboard !== 'boolean') {
    errors.push('allowDiscordLeaderboard must be a boolean');
  }

  if (config.discordWebhookUrl !== undefined && typeof config.discordWebhookUrl !== 'string') {
    errors.push('discordWebhookUrl must be a string');
  }

  if (config.discordWebhookUrl) {
    const trimmed = String(config.discordWebhookUrl).trim();
    const isDiscordWebhook = /^https?:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\//i.test(trimmed);
    if (!isDiscordWebhook) {
      errors.push('discordWebhookUrl must be a valid Discord webhook URL');
    }
  }

  if (config.discordServerName !== undefined && typeof config.discordServerName !== 'string') {
    errors.push('discordServerName must be a string');
  }

  if (config.discordPlayerName !== undefined && typeof config.discordPlayerName !== 'string') {
    errors.push('discordPlayerName must be a string');
  }

  if (config.leaderboardWebhooks !== undefined && typeof config.leaderboardWebhooks !== 'object') {
    errors.push('leaderboardWebhooks must be an object');
  } else if (config.leaderboardWebhooks) {
    const allowedKeys = [
      'killsTotal',
      'killsSession',
      'killsPerHour',
      'killsPerMin',
      'expTotal',
      'expPerHour',
      'expPerMin',
      'expSession',
      'avgKillTime'
    ];
    const webhookPattern = /^https?:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\//i;
    for (const [key, url] of Object.entries(config.leaderboardWebhooks)) {
      if (!allowedKeys.includes(key)) continue;
      if (url && typeof url !== 'string') {
        errors.push(`leaderboardWebhooks.${key} must be a string`);
      } else if (url && !webhookPattern.test(String(url).trim())) {
        errors.push(`leaderboardWebhooks.${key} must be a valid Discord webhook URL`);
      }
    }
  }

  if (!Object.values(PERSIST_MODES).includes(config.persistMode)) {
    errors.push(`persistMode must be one of: ${Object.values(PERSIST_MODES).join(', ')}`);
  }

  if (typeof config.killHpWindowMs !== 'number' || config.killHpWindowMs < 200 || config.killHpWindowMs > 5000) {
    errors.push('killHpWindowMs must be a number between 200 and 5000 (ms)');
  }

  if (typeof config.epsilon !== 'number' || config.epsilon < 0 || config.epsilon > 1) {
    errors.push('epsilon must be a number between 0 and 1');
  }

  if (typeof config.rollingWindowSec !== 'number' || config.rollingWindowSec < 10) {
    errors.push('rollingWindowSec must be a number >= 10');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Validate layout object
function validateLayout(layout) {
  const errors = [];

  if (typeof layout !== 'object' || layout === null) {
    return { valid: false, errors: ['Layout must be an object'] };
  }

  if (!Array.isArray(layout.order)) {
    errors.push('order must be an array');
  }

  if (typeof layout.visibility !== 'object') {
    errors.push('visibility must be an object');
  }

  if (typeof layout.overlayVisible !== 'boolean') {
    errors.push('overlayVisible must be a boolean');
  }

  if (layout.rows !== undefined && (typeof layout.rows !== 'number' || layout.rows <= 0)) {
    errors.push('rows must be a positive number');
  }

  if (layout.scale !== undefined && (typeof layout.scale !== 'number' || layout.scale <= 0)) {
    errors.push('scale must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Merge partial config with defaults
function mergeWithDefaults(partial, defaults) {
  const result = { ...defaults };

  if (partial && typeof partial === 'object') {
    for (const key of Object.keys(defaults)) {
      if (partial[key] !== undefined) {
        result[key] = partial[key];
      }
    }
  }

  return result;
}

// Migrate old schema versions to current
function migrateConfig(config) {
  if (!config || typeof config !== 'object') {
    return getDefaultConfig();
  }

  const currentVersion = config.schemaVersion || 0;

  // No migrations needed yet for v1
  if (currentVersion < SCHEMA_VERSION) {
    // Future migrations would go here
    config.schemaVersion = SCHEMA_VERSION;
  }

  config.pluginVersion = PLUGIN_VERSION;

  return mergeWithDefaults(config, getDefaultConfig());
}

// Migrate old layout schema
function migrateLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return getDefaultLayout();
  }

  const currentVersion = layout.schemaVersion || 0;

  if (currentVersion < SCHEMA_VERSION) {
    layout.schemaVersion = SCHEMA_VERSION;
  }

  layout.pluginVersion = PLUGIN_VERSION;

  const merged = mergeWithDefaults(layout, getDefaultLayout());

  // Ensure order contains all keys
  for (const key of BADGE_KEYS) {
    if (!merged.order.includes(key)) {
      merged.order.push(key);
    }
  }

  // Ensure visibility has all keys
  const defaults = getDefaultBadgeVisibility();
  merged.visibility = merged.visibility || {};
  for (const key of BADGE_KEYS) {
    if (merged.visibility[key] === undefined) {
      merged.visibility[key] = defaults[key];
    }
  }

  // Ensure rows is a positive number
  merged.rows = Math.max(1, Math.floor(Number(merged.rows) || defaults.rows || 1));

  // Clamp scale to a sensible range
  const scale = Number(merged.scale);
  merged.scale = Number.isFinite(scale) ? Math.min(2, Math.max(0.5, scale)) : defaults.scale;

  return merged;
}

// Migrate old profile state
function migrateProfileState(state) {
  if (!state || typeof state !== 'object') {
    return getDefaultProfileState();
  }

  const currentVersion = state.schemaVersion || 0;

  if (currentVersion < SCHEMA_VERSION) {
    state.schemaVersion = SCHEMA_VERSION;
  }

  state.pluginVersion = PLUGIN_VERSION;

  return mergeWithDefaults(state, getDefaultProfileState());
}

// Format time duration (ms) to human readable HH:MM:SS
function formatDuration(ms) {
  if (ms === null || ms === undefined || isNaN(ms) || ms < 0) return '0:00:00';

  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Format duration with milliseconds precision
function formatDurationMs(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '0:00:00.000';
  const totalMs = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const millis = totalMs % 1000;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// Format exp percentage
function formatExp(exp) {
  if (exp === null || exp === undefined || isNaN(exp)) return '0.0000%';
  return exp.toFixed(4) + '%';
}

// Format number with locale
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Export for Node.js (main process) and browser (UI)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SCHEMA_VERSION,
    PLUGIN_VERSION,
    BADGE_KEYS,
    BADGE_LABELS,
    MONSTER_RANKS,
    PERSIST_MODES,
    getDefaultConfig,
    getDefaultBadgeVisibility,
    getDefaultLayout,
    getDefaultProfileState,
    validateConfig,
    validateLayout,
    mergeWithDefaults,
    migrateConfig,
    migrateLayout,
    migrateProfileState,
    formatDuration,
    formatDurationMs,
    formatExp,
    formatNumber
  };
}
