/**
 * Killfeed Plugin - Stats Engine
 * Handles kill detection, rolling window calculations, and statistics computation.
 */

const schema = typeof require !== 'undefined'
  ? require('./schema.js')
  : window.KillfeedSchema;

/**
 * Creates a new stats engine instance for a profile.
 * @param {object} config - Global plugin config
 * @param {object} initialState - Initial profile state (from storage or defaults)
 * @returns {object} Stats engine instance
 */
function createStatsEngine(config, initialState) {
  // Clone initial state to avoid mutations
  let state = JSON.parse(JSON.stringify(initialState || schema.getDefaultProfileState()));
  let cfg = config || schema.getDefaultConfig();

  function getDayKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function ensureDailyExpTotal(now) {
    const today = getDayKey(now);
    if (state.expTotalDay !== today) {
      state.expTotalDay = today;
      state.expTotal = 0;
    }
  }

  // Pending suspect kill (awaiting confirmation)
  let pendingSuspect = null;

  /**
   * Update config
   */
  function setConfig(newConfig) {
    cfg = newConfig || schema.getDefaultConfig();
  }

  /**
   * Get current raw state
   */
  function getState() {
    return state;
  }

  /**
   * Set state directly (for restore from storage)
   */
  function setState(newState) {
    state = schema.migrateProfileState(newState);
  }

  /**
   * Apply a manual EXP baseline without counting it as gain.
   */
  function applyManualExp(exp, lvl, timestamp) {
    if (exp === null || exp === undefined || isNaN(exp)) {
      return;
    }
    const now = timestamp || Date.now();
    ensureDailyExpTotal(now);
    if (lvl !== null && lvl !== undefined && !isNaN(lvl)) {
      state.lastLvl = lvl;
    }
    state.lastExp = exp;
    state.lastExpRaw = exp;
    state.lastUpdateTime = now;
    pendingSuspect = null;
  }

  /**
   * Reset session stats (keeps totals)
   */
  function resetSession() {
    state.killsSession = 0;
    state.expSession = 0;
    state.sessionStartTime = null;
    state.rollingKills = [];
    state.lastKillTime = null;
    state.last3Kills = [];
  }

  /**
   * Reset all stats including totals
   */
  function resetAll() {
    state = schema.getDefaultProfileState();
    ensureDailyExpTotal(Date.now());
    state.sessionStartTime = Date.now();
  }

  /**
   * Start a new session
   */
  function startSession() {
    if (!state.sessionStartTime) {
      state.sessionStartTime = Date.now();
    }
  }

  /**
   * Calculate median of an array
   */
  function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Prune rolling window data older than rollingWindowSec
   */
  function pruneRollingWindow(now) {
    const cutoff = now - (cfg.rollingWindowSec * 1000);
    state.rollingKills = state.rollingKills.filter(k => k.timestamp > cutoff);
  }

  /**
   * Get monster rank category (placeholder - returns UNKNOWN until rank DB is implemented)
   */
  function getMonsterRank(monsterName) {
    // TODO: Implement monster rank lookup from database
    // For now, return UNKNOWN/NORMAL
    return schema.MONSTER_RANKS.UNKNOWN;
  }

  /**
  /**
   * Process an OCR tick update
   * @param {number} lvl - Current level
   * @param {number} exp - Current exp percentage (0.0 - 99.9999)
   * @param {string|null} charName - Character name
   * @param {string|null} monsterName - Last killed monster name
   * @param {number} timestamp - Update timestamp (ms)
   * @param {number|undefined} enemyHpSeenAt - Last timestamp when an enemy HP bar was seen
   * @param {object|undefined} monsterMeta - { id?, element?, level?, expectedExp? }
   * @param {function|undefined} killValidator - optional validator (deltaExp, meta) => boolean
   * @returns {object|null} Kill event if a kill was detected, null otherwise
   */
  function update(lvl, exp, charName, monsterName, timestamp, rawExp, enemyHpSeenAt, monsterMeta, killValidator) {
    const now = timestamp || Date.now();
    ensureDailyExpTotal(now);
    const hpWindowMs = typeof cfg.killHpWindowMs === 'number' && cfg.killHpWindowMs > 0
      ? cfg.killHpWindowMs
      : 1500;
    const hasRecentEnemyHp = typeof enemyHpSeenAt === 'number' && (now - enemyHpSeenAt) <= hpWindowMs;
    const fallbackNoHpGapMs = Math.max(2000, hpWindowMs * 1.5);
    const timeSinceLastKill = state.lastKillTime ? now - state.lastKillTime : Infinity;
    const allowWithoutHp = !hasRecentEnemyHp && timeSinceLastKill >= fallbackNoHpGapMs;

    // Defensive: validate inputs
    if (lvl === null || lvl === undefined || isNaN(lvl)) {
      // Wenn kein Level vom OCR kommt, nutze das zuletzt bekannte Level,
      // damit currentExp trotzdem aktualisiert wird.
      if (state.lastLvl === null || state.lastLvl === undefined || isNaN(state.lastLvl)) {
        return null;
      }
      lvl = state.lastLvl;
    }
    if (exp === null || exp === undefined || isNaN(exp)) {
      return null;
    }

    // Prune old rolling window data
    pruneRollingWindow(now);

    const prevLvl = state.lastLvl;
    const prevExp = state.lastExp;
    const displayExp = Number.isFinite(rawExp) ? rawExp : exp;

    // Update last values
    state.lastLvl = lvl;
    state.lastExp = exp;
    state.lastExpRaw = displayExp;
    state.lastUpdateTime = now;

    // First tick - no comparison possible
    if (prevLvl === null || prevExp === null) {
      return null;
    }

    let killEvent = null;

    // Level up detection
    if (lvl > prevLvl) {
      // Level up occurred - NOT counted as a kill
      // Reset suspect if any
      pendingSuspect = null;
      return null;
    }

    // Level decreased (reroll or OCR error)
    if (lvl < prevLvl) {
      pendingSuspect = null;
      return null;
    }

    // Same level - check for exp change
    const deltaExp = exp - prevExp;

    // EXP decreased on same level - OCR noise, just update state
    if (deltaExp < 0) {
      pendingSuspect = null;
      return null;
    }

    // EXP increased - potential kill
    if (deltaExp > cfg.epsilon) {
      // Require a recent enemy HP bar to avoid counting stray EXP ticks as kills.
      // If no HP bar was seen for a while, allow the kill to avoid dropping legit events
      // when the HP overlay briefly fails.
      if (!hasRecentEnemyHp && !allowWithoutHp) {
        pendingSuspect = null;
        return null;
      }

      // Check for suspect (unrealistic) jumps
      if (deltaExp > cfg.suspectThreshold) {
        // Store as suspect, wait for confirmation
        pendingSuspect = {
          deltaExp,
          monsterName: monsterName || 'Unknown',
          timestamp: now
        };
        return null;
      }

      // If we had a pending suspect and this tick is normal, process the suspect
      if (pendingSuspect) {
        // Check if this tick confirms suspect (small delta after big one means suspect was real)
        // For simplicity, discard suspect and process current tick normally
        pendingSuspect = null;
      }

      // Validate against external criteria if provided
      if (typeof killValidator === 'function') {
        const valid = killValidator(deltaExp, monsterMeta || {});
        if (!valid) {
          return null;
        }
      }

      // Register kill
      killEvent = registerKill(deltaExp, monsterName, now, monsterMeta);
    }

    return killEvent;
  }

  /**
   * Register a confirmed kill
   */
  function registerKill(deltaExp, monsterName, timestamp, monsterMeta) {
    const name = monsterName || 'Unknown';
    const rank = getMonsterRank(name);

    if (!state.sessionStartTime) {
      state.sessionStartTime = timestamp;
    }

    // Increment counters
    state.killsSession++;
    state.killsTotal++;

    // Add to exp totals
    state.expSession += deltaExp;
    state.expTotal += deltaExp;

    // Update last kill time
    state.lastKillTime = timestamp;

    // Add to rolling window
    state.rollingKills.push({
      timestamp,
      deltaExp
    });

    // Update last 3 kills (for avg calculation)
    state.last3Kills.push({
      monsterName: name,
      deltaExp,
      timestamp,
      monsterId: monsterMeta && monsterMeta.id,
      monsterElement: monsterMeta && monsterMeta.element,
      monsterLevel: monsterMeta && monsterMeta.level,
      expectedExp: monsterMeta && monsterMeta.expectedExp
    });
    if (state.last3Kills.length > 3) {
      state.last3Kills.shift();
    }

    // Update monster tracking
    if (!state.monsters[name]) {
      state.monsters[name] = {
        count: 0,
        rank,
        lastKillTime: null
      };
    }
    state.monsters[name].count++;
    state.monsters[name].lastKillTime = timestamp;

    return {
      type: 'kill',
      monsterName: name,
      deltaExp,
      timestamp,
      rank
    };
  }

  /**
   * Compute all display values from current state
   * @returns {object} Computed stats object
   */
  function compute() {
    const now = Date.now();
    ensureDailyExpTotal(now);
    pruneRollingWindow(now);

    const sessionDurationMs = state.sessionStartTime
      ? now - state.sessionStartTime
      : 0;
    const sessionDurationSec = sessionDurationMs / 1000;
    const sessionDurationHours = sessionDurationSec / 3600;

    // Rolling window calculations
    const rollingDurationMs = cfg.rollingWindowSec * 1000;
    const rollingSec = cfg.rollingWindowSec;
    const rollingHours = rollingSec / 3600;

    // Kills in rolling window
    const rollingKillCount = state.rollingKills.length;
    const rollingExpSum = state.rollingKills.reduce((sum, k) => sum + k.deltaExp, 0);

    // Kills per hour/min (based on rolling window for expectation)
    const killsPerHour = rollingKillCount > 0 && rollingHours > 0
      ? rollingKillCount / rollingHours
      : 0;
    const killsPerMin = killsPerHour / 60;

    // EXP per hour/min (based on rolling window)
    const expPerHour = rollingKillCount > 0 && rollingHours > 0
      ? rollingExpSum / rollingHours
      : 0;
    const expPerMin = expPerHour / 60;

    // EXP from last kill
    const expLastKill = state.last3Kills.length > 0
      ? state.last3Kills[state.last3Kills.length - 1].deltaExp
      : 0;

    // Average time per kill (from rolling window)
    let avgTimePerKillMs = 0;
    if (state.rollingKills.length >= 2) {
      const sorted = [...state.rollingKills].sort((a, b) => a.timestamp - b.timestamp);
      const firstKillTime = sorted[0].timestamp;
      const lastKillTime = sorted[sorted.length - 1].timestamp;
      const totalTimeMs = lastKillTime - firstKillTime;
      avgTimePerKillMs = totalTimeMs / (sorted.length - 1);
    }

    // Time since last kill
    const timeSinceLastKillMs = state.lastKillTime
      ? now - state.lastKillTime
      : 0;

    // Kills to level up calculation
    let killsToLevel = 0;
    if (state.last3Kills.length > 0 && state.lastExp !== null) {
      const deltas = state.last3Kills.map(k => k.deltaExp);
      const avgDelta = Math.max(median(deltas), cfg.minDelta);
      const remaining = 100.0 - state.lastExp;
      killsToLevel = Math.ceil(remaining / avgDelta);
    }

    // Group monsters by rank
    const monstersByRank = {
      [schema.MONSTER_RANKS.NORMAL]: [],
      [schema.MONSTER_RANKS.GIANT]: [],
      [schema.MONSTER_RANKS.VIOLET]: [],
      [schema.MONSTER_RANKS.BOSS]: [],
      [schema.MONSTER_RANKS.UNKNOWN]: []
    };

    for (const [name, data] of Object.entries(state.monsters)) {
      const rank = data.rank || schema.MONSTER_RANKS.UNKNOWN;
      monstersByRank[rank].push({
        name,
        count: data.count,
        lastKillTime: data.lastKillTime
      });
    }

    // Sort monsters by count descending
    for (const rank of Object.keys(monstersByRank)) {
      monstersByRank[rank].sort((a, b) => b.count - a.count);
    }

    return {
      // Session stats
      killsSession: state.killsSession,
      expSession: state.expSession,
      sessionDuration: sessionDurationMs,
      sessionDurationFormatted: schema.formatDuration(sessionDurationMs),

      // Total stats
      killsTotal: state.killsTotal,
      expTotal: state.expTotal,

      // Rate stats (based on rolling window)
      killsPerHour: Math.round(killsPerHour * 10) / 10,
      killsPerMin: Math.round(killsPerMin * 100) / 100,
      expPerHour: Math.round(expPerHour * 10000) / 10000,
      expPerMin: Math.round(expPerMin * 10000) / 10000,

      // Last kill stats
      expLastKill,
      expLastKillFormatted: schema.formatExp(expLastKill),

      // Time stats
      avgTimePerKill: avgTimePerKillMs,
      avgTimePerKillFormatted: schema.formatDuration(avgTimePerKillMs),
      timeSinceLastKill: timeSinceLastKillMs,
      timeSinceLastKillFormatted: schema.formatDuration(timeSinceLastKillMs),

      // Projection
      killsToLevel,

      // Last 3 kills detail
      last3Kills: state.last3Kills.map(k => ({
        monsterName: k.monsterName,
        deltaExp: k.deltaExp,
        deltaExpFormatted: schema.formatExp(k.deltaExp),
        timestamp: k.timestamp
      })),

      // Monster breakdown
      monstersByRank,

      // Meta
      lastUpdateTime: state.lastUpdateTime,
      currentLvl: state.lastLvl,
      currentExp: state.lastExpRaw ?? state.lastExp,
      currentExpFormatted: schema.formatExp(state.lastExpRaw ?? state.lastExp),
      expTotalDay: state.expTotalDay
    };
  }

  return {
    setConfig,
    getState,
    setState,
    resetSession,
    resetAll,
    startSession,
    applyManualExp,
    update,
    compute
  };
}

// Export for Node.js (main process) and browser (UI)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createStatsEngine
  };
}
