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
  // Pending level drop candidate to distinguish OCR noise from real mode switches.
  let pendingLevelDrop = null;
  // Pending exp-drop candidate: distinguishes a single OCR down-jitter (keep
  // baseline) from a baseline that is genuinely too high (correct it down).
  let pendingExpDrop = null;
  // Lump-Splitting: Bei OCR-Haengern werden mehrere Kills zu EINEM EXP-Sprung
  // zusammengefasst. `recentDeltas` haelt die letzten deltaExp-Proben des
  // aktuellen Monsters; daraus wird robust die Einzel-Kill-EXP geschaetzt, um
  // den Sprung wieder in die echte Anzahl Kills aufzuteilen. `lastUnitMonster`
  // erkennt den Monsterwechsel (andere Einheit → Fenster zuruecksetzen).
  let lastUnitMonster = null;
  let recentDeltas = [];

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
    pendingSuspect = null;
    pendingLevelDrop = null;
    pendingExpDrop = null;
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
    pendingLevelDrop = null;
    pendingExpDrop = null;
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
    pendingSuspect = null;
    pendingLevelDrop = null;
    pendingExpDrop = null;
  }

  /**
   * Reset all stats including totals
   */
  function resetAll() {
    state = schema.getDefaultProfileState();
    ensureDailyExpTotal(Date.now());
    state.sessionStartTime = Date.now();
    pendingSuspect = null;
    pendingLevelDrop = null;
    pendingExpDrop = null;
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
   * Get monster rank category from monsterMeta.rank.
   * Maps small/normal/captain/material/super → 'normal', giant/violet/boss/worldboss to their category.
   */
  function getMonsterRank(monsterName, monsterMeta) {
    const raw = monsterMeta && typeof monsterMeta.rank === 'string' ? monsterMeta.rank.toLowerCase() : null;
    if (!raw) return schema.MONSTER_RANKS.UNKNOWN;
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
      default:
        return schema.MONSTER_RANKS.UNKNOWN;
    }
  }

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

    // Always keep raw display value fresh, but only advance the kill baseline
    // (lastLvl/lastExp) after sanity checks to avoid OCR down-spikes.
    state.lastExpRaw = displayExp;
    state.lastUpdateTime = now;

    // First tick - no comparison possible
    if (prevLvl === null || prevExp === null) {
      state.lastLvl = lvl;
      state.lastExp = exp;
      pendingLevelDrop = null;
      pendingExpDrop = null;
      return null;
    }

    let killEvent = null;

    // Level up detection
    if (lvl > prevLvl) {
      // Level up occurred - NOT counted as a kill
      // Reset suspect if any
      pendingSuspect = null;
      pendingLevelDrop = null;
      pendingExpDrop = null;
      // Nach einem Level-up aendert sich die EXP-pro-Kill in Prozent (anderer
      // EXP-Bedarf) → Lump-Splitting-Proben verwerfen, sonst splittet die
      // veraltete Einheit falsch.
      recentDeltas = [];
      state.lastLvl = lvl;
      state.lastExp = exp;
      return null;
    }

    // Level decreased:
    // - large drops are treated as a mode switch and re-baselined immediately
    // - small drops require short confirmation to avoid OCR jitter regressions
    if (lvl < prevLvl) {
      pendingSuspect = null;
      const drop = prevLvl - lvl;
      const immediateSwitchDrop = 20;

      if (drop >= immediateSwitchDrop) {
        state.lastLvl = lvl;
        state.lastExp = exp;
        pendingLevelDrop = null;
        return null;
      }

      if (!pendingLevelDrop || pendingLevelDrop.level !== lvl) {
        pendingLevelDrop = { level: lvl, firstSeenAt: now, confirmations: 1 };
        return null;
      }

      pendingLevelDrop.confirmations += 1;
      const stableForMs = now - pendingLevelDrop.firstSeenAt;
      if (pendingLevelDrop.confirmations >= 3 || stableForMs >= 1200) {
        state.lastLvl = lvl;
        state.lastExp = exp;
        pendingLevelDrop = null;
      }
      return null;
    }

    pendingLevelDrop = null;

    // Same level - check for exp change
    const deltaExp = exp - prevExp;

    // EXP decreased on same level.
    if (deltaExp < 0) {
      pendingSuspect = null;
      // Level-up-Erkennung bei GLEICHEM Level: Wenn das Spielerlevel per
      // manuellem Override gepinnt ist (oder die lvl-OCR deaktiviert ist),
      // feuert der `lvl > prevLvl`-Zweig nie. Ein echter Flyff-Level-up
      // wickelt die EXP aber immer von ~95-100 % auf ~0-5 % um. Diese
      // Umwicklung als Level-up behandeln: Baseline neu setzen (sonst bleibt
      // `lastExp` auf dem Vor-Level-up-Wert haengen und alle weiteren Kills
      // erzeugen ein negatives deltaExp und gehen verloren). Schwellwerte
      // identisch zur `isLevelUpDrop`-Logik des Core-OCR.
      const isLevelUpWrap = prevExp >= 85 && exp < 5 && (prevExp - exp) >= 80;
      if (isLevelUpWrap) {
        pendingLevelDrop = null;
        pendingExpDrop = null;
        // Level-up (EXP-Umwicklung) → Lump-Splitting-Proben verwerfen.
        recentDeltas = [];
        state.lastLvl = lvl;
        state.lastExp = exp;
        return null;
      }
      // exp liegt unter der Baseline. Ein einzelner Ausreisser ist OCR-Rauschen
      // → Baseline behalten (sonst entstehen falsche Spikes / verpasste Kills).
      // Liegt exp aber mehrere Ticks IN FOLGE darunter, ist die Baseline selbst
      // zu hoch: `lastExp` ratscht durch positive OCR-Jitter-Spitzen nur nach
      // oben und kommt nie zurueck. Das erzeugt eine tote Zone — typisch direkt
      // nach einem Neustart, wenn der gespeicherte High-Water-Mark geladen wird
      // — in der echte Kills verschluckt werden. Nach 3 Bestaetigungen bzw.
      // 1,2 s die Baseline nach unten korrigieren (nicht als Kill zaehlen).
      if (!pendingExpDrop) {
        pendingExpDrop = { firstSeenAt: now, confirmations: 1 };
      } else {
        pendingExpDrop.confirmations += 1;
      }
      if (pendingExpDrop.confirmations >= 3 || (now - pendingExpDrop.firstSeenAt) >= 1200) {
        state.lastLvl = lvl;
        state.lastExp = exp;
        pendingExpDrop = null;
      }
      return null;
    }

    // Non-negative same-level sample is safe: advance baseline.
    pendingExpDrop = null;
    state.lastLvl = lvl;
    state.lastExp = exp;

    // EXP increased - potential kill
    if (deltaExp > cfg.epsilon) {
      // Require a recent enemy HP bar to avoid counting stray EXP ticks as kills.
      // If no HP bar was seen for a while, allow the kill to avoid dropping legit events
      // when the HP overlay briefly fails.
      if (!hasRecentEnemyHp && !allowWithoutHp) {
        pendingSuspect = null;
        // Kill ohne HP-Bestaetigung: nicht zaehlen — aber die Baseline NICHT
        // fortschreiben (zurueck auf prevExp). Sonst wird der EXP-Zuwachs in
        // die Baseline geschluckt und der Kill geht ENDGUELTIG verloren.
        // So bleibt der Zuwachs erhalten und wird beim naechsten HP-
        // bestaetigten Tick (bzw. ueber den allowWithoutHp-Fallback nach
        // ~2,25 s) nachgezaehlt — zusammengefasst statt verschluckt.
        state.lastExp = prevExp;
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
   * Robuste Schaetzung der Einzel-Kill-EXP aus den letzten deltaExp-Proben.
   * Einzelkills dominieren die Stichprobe; Lumps (ganzzahlige Vielfache) und
   * OCR-Jitter (zu kleine Teil-Reads) sind selten — der Median ist gegen
   * beide robust. Anschliessend wird der Mittelwert NUR ueber den
   * Einzelkill-Cluster (~0,6x..1,6x Median) gebildet: Lumps (>=~1,7x) und
   * Jitter (<0,6x) fallen heraus.
   * @returns {number|null} geschaetzte Einheit, oder null bei zu wenig Daten
   */
  function estimateUnitExp(samples) {
    if (!samples || samples.length < 4) return null;
    const sorted = samples.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (!(median > 0)) return null;
    const cluster = sorted.filter((v) => v >= median * 0.6 && v <= median * 1.6);
    if (cluster.length === 0) return median;
    return cluster.reduce((s, v) => s + v, 0) / cluster.length;
  }

  /**
   * Register a confirmed kill
   */
  function registerKill(deltaExp, monsterName, timestamp, monsterMeta) {
    const name = monsterName || 'Unknown';
    const rank = getMonsterRank(name, monsterMeta);

    // Lump-Splitting: Bei langsamer/uebersprungener OCR werden mehrere echte
    // Kills zu EINEM EXP-Sprung zusammengefasst. Ueber eine robuste Schaetzung
    // der Einzel-Kill-EXP wird ermittelt, wie viele Kills im deltaExp stecken.
    //
    // Monsterwechsel → Probenfenster zuruecksetzen (andere Einheit).
    if (name !== lastUnitMonster) {
      recentDeltas = [];
      lastUnitMonster = name;
    }
    if (deltaExp > 0) {
      recentDeltas.push(deltaExp);
      if (recentDeltas.length > 21) recentDeltas.shift();
    }

    let killCount = 1;
    // estimateUnitExp liefert erst ab 4 Proben einen Wert → die ersten 3 Kills
    // nach einem Monsterwechsel werden bewusst als je 1 gezaehlt (zu wenig
    // Daten zum Splitten; verhindert Ueberzaehlung beim Wechsel).
    const estUnit = estimateUnitExp(recentDeltas);
    if (estUnit && estUnit > 0) {
      const ratio = deltaExp / estUnit;
      const nearest = Math.round(ratio);
      // Nur splitten, wenn das Verhaeltnis WIRKLICH nahe an einer ganzen Zahl
      // liegt. Ein krummes Verhaeltnis (z. B. 1,75) bedeutet: die Einheit-
      // Schaetzung passt (noch) nicht — NICHT, dass es Teil-Kills gibt.
      // → dann konservativ als 1 zaehlen.
      if (nearest >= 2 && Math.abs(ratio - nearest) <= 0.25) {
        killCount = nearest;
      }
    }
    // expectedExp (Monster-Tabelle) ist ein konservativer UNTERwert der echten
    // Einzel-Kill-EXP. Die implizite Einheit (deltaExp/killCount) darf nie
    // darunter fallen → oberer Sicherheits-Deckel gegen extreme Fehlschaetzung.
    const expectedExp = monsterMeta && Number(monsterMeta.expectedExp);
    if (Number.isFinite(expectedExp) && expectedExp > 0) {
      const maxByExpected = Math.floor(deltaExp / expectedExp);
      if (maxByExpected >= 1 && killCount > maxByExpected) {
        killCount = maxByExpected;
      }
    }
    if (killCount < 1) killCount = 1;
    if (killCount > 30) killCount = 30;

    if (!state.sessionStartTime) {
      state.sessionStartTime = timestamp;
    }

    // Increment counters (killCount > 1 = zusammengefasster OCR-Haenger)
    state.killsSession += killCount;
    state.killsTotal += killCount;

    // Add to exp totals
    state.expSession += deltaExp;
    state.expTotal += deltaExp;

    // Update last kill time
    state.lastKillTime = timestamp;

    // Add to rolling window — je geschaetztem Kill ein Eintrag, damit
    // Kills/Stunde und Kills/Min korrekt bleiben.
    const unitDelta = deltaExp / killCount;
    for (let i = 0; i < killCount; i++) {
      state.rollingKills.push({ timestamp, deltaExp: unitDelta });
    }

    // Update last 3 kills (for avg calculation)
    state.last3Kills.push({
      monsterName: name,
      deltaExp,
      timestamp,
      killCount,
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
        rank: rank,
        lastKillTime: null
      };
    }
    state.monsters[name].count += killCount;
    state.monsters[name].lastKillTime = timestamp;
    // Update rank if we now have better info (e.g., was 'unknown', now resolved)
    if (rank !== schema.MONSTER_RANKS.UNKNOWN) {
      state.monsters[name].rank = rank;
    }

    return {
      type: 'kill',
      monsterName: name,
      deltaExp,
      timestamp,
      rank,
      killCount
    };
  }

  /**
   * Rollback the most recently registered kill.
   * Used when post-registration validation (e.g. EXP table check) rejects a kill.
   * @returns {boolean} true if a kill was rolled back, false if nothing to undo
   */
  function rollbackLastKill() {
    if (state.last3Kills.length === 0) return false;

    const lastKill = state.last3Kills.pop();
    const n = Math.max(1, Math.round(Number(lastKill.killCount) || 1));

    state.killsSession = Math.max(0, state.killsSession - n);
    state.killsTotal = Math.max(0, state.killsTotal - n);
    state.expSession = Math.max(0, state.expSession - lastKill.deltaExp);
    state.expTotal = Math.max(0, state.expTotal - lastKill.deltaExp);

    // Remove the rolling-window entries for this kill (n Eintraege mit
    // gleichem Timestamp — siehe Lump-Splitting in registerKill).
    let removed = 0;
    for (let i = state.rollingKills.length - 1; i >= 0 && removed < n; i--) {
      if (state.rollingKills[i].timestamp === lastKill.timestamp) {
        state.rollingKills.splice(i, 1);
        removed++;
      }
    }

    // Update monster tracking
    const name = lastKill.monsterName;
    if (state.monsters[name]) {
      state.monsters[name].count -= n;
      if (state.monsters[name].count <= 0) {
        delete state.monsters[name];
      }
    }

    // Restore lastKillTime from remaining kills
    if (state.last3Kills.length > 0) {
      state.lastKillTime = state.last3Kills[state.last3Kills.length - 1].timestamp;
    } else {
      state.lastKillTime = null;
    }

    return true;
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
    rollbackLastKill,
    compute
  };
}

// Export for Node.js (main process) and browser (UI)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createStatsEngine
  };
}
