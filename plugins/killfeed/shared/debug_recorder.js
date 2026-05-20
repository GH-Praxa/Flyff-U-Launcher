/**
 * Killfeed Plugin - Debug Recorder
 * =================================
 * Ressourcenschonendes Diagnose-Tool: erfasst Kill-/Scan-/Monster-Events in
 * Echtzeit, erkennt automatisch Auffaelligkeiten und schreibt sie LLM-freundlich
 * als NDJSON (eine JSON-Zeile pro Event) weg.
 *
 * WICHTIG (siehe DEV-NOTES.md, Sackgasse "Datei-Debug-Logging im Hot-Path"):
 * NIEMALS synchrones Datei-I/O pro OCR-Tick. `fs.appendFileSync` im OCR-Pfad
 * hat den gesamten Launcher eingefroren. Dieser Recorder vermeidet das:
 *   - jedes Event landet zuerst in einem RAM-Ringpuffer (O(1), kein I/O),
 *   - ein einzelnes Flush-Intervall schreibt gebuendelt + asynchron
 *     (`fs.promises.appendFile`) auf die Platte,
 *   - alle record*()-Aufrufe sind synchron, allokationsarm und kehren sofort
 *     zurueck — der OCR-Aufrufer wird nie blockiert.
 *
 * Plattform: reines Node-fs/zlib/path, keine OS-spezifischen Annahmen
 * (Windows/Linux/macOS identisch).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SCHEMA_VERSION = 1;

// Obergrenze fuer die ungeschriebene Flush-Warteschlange. Falls die Platte
// klemmt, werden hier die AELTESTEN Zeilen verworfen (gezaehlt in stats.dropped),
// damit der RAM nicht unbegrenzt waechst.
const MAX_PENDING_LINES = 50000;

/**
 * ISO-8601-Zeitstempel mit lokalem Zeitzonen-Offset, inkl. Millisekunden.
 * Beispiel: 2026-05-18T14:30:00.123+02:00
 */
function isoTimestamp(ms) {
  const d = new Date(typeof ms === 'number' ? ms : Date.now());
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const tzAbs = Math.abs(tzMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${sign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`
  );
}

/** Median einer Zahlenliste (nicht-mutierend). */
function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Quantil q (0..1) einer BEREITS SORTIERTEN Liste, lineare Interpolation. */
function quantile(sorted, q) {
  if (!sorted || sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function round(n, decimals) {
  const f = Math.pow(10, decimals || 0);
  return Math.round(n * f) / f;
}

/**
 * Erzeugt eine Recorder-Instanz.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled        - Recorder aktiv? (sonst sind alle record*-Methoden No-Ops)
 * @param {string}  opts.dir            - Zielverzeichnis fuer NDJSON-Dateien
 * @param {number}  [opts.maxRamEntries=10000] - Groesse des Live-Ringpuffers
 * @param {number}  [opts.flushIntervalMs=4000] - Intervall des Hintergrund-Flush
 * @param {number}  [opts.flushBatchSize=400]   - Vorzeitiger Flush ab so vielen offenen Zeilen
 * @param {number}  [opts.maxFileBytes=5242880] - Rotation ab dieser Dateigroesse (5 MiB)
 * @param {number}  [opts.maxArchives=10]       - Anzahl aufbewahrter .gz-Archive
 * @param {number}  [opts.scanSampleRate=1]     - Nur jedes N-te Scan-Event loggen (Kills/Anomalien immer)
 * @param {boolean} [opts.dedupeScans=true]     - Unveraenderte Folge-Scans nicht loggen
 * @param {number}  [opts.hpHistoryLen=12]      - Laenge der HP-Historie pro Monster
 * @param {number}  [opts.epsilon=0.001]        - EXP-Schwelle (aus Plugin-Config)
 * @param {number}  [opts.suspectThreshold=40]  - Verdaechtiger EXP-Sprung in % (aus Plugin-Config)
 * @param {number}  [opts.duplicateWindowMs=350]- Zeitfenster fuer Doppelkill-Erkennung
 * @param {function}[opts.logger]               - optionaler Fehler-Logger (msg) => void
 */
function createDebugRecorder(opts) {
  const o = opts || {};
  const enabled = !!o.enabled;
  const dir = o.dir;
  const maxRamEntries = clampInt(o.maxRamEntries, 100, 200000, 10000);
  const flushIntervalMs = clampInt(o.flushIntervalMs, 500, 60000, 4000);
  const flushBatchSize = clampInt(o.flushBatchSize, 10, 20000, 400);
  const maxFileBytes = clampInt(o.maxFileBytes, 64 * 1024, 256 * 1024 * 1024, 5 * 1024 * 1024);
  const maxArchives = clampInt(o.maxArchives, 0, 1000, 10);
  const scanSampleRate = clampInt(o.scanSampleRate, 1, 10000, 1);
  const dedupeScans = o.dedupeScans !== false;
  const hpHistoryLen = clampInt(o.hpHistoryLen, 2, 200, 12);
  const epsilon = Number.isFinite(o.epsilon) ? o.epsilon : 0.001;
  const suspectThreshold = Number.isFinite(o.suspectThreshold) ? o.suspectThreshold : 40;
  // Einzel-Kill-EXP ueber diesem %-Wert gilt als unplausibel (Review-Flag).
  // Fuellt die Luecke unter `suspectThreshold` (40 %): ein Kill mit z.B. 20 %
  // ist absurd, wird vom Engine-Suspect-Check aber nicht erfasst.
  const killOutlierPercent = Number.isFinite(o.killOutlierPercent) ? o.killOutlierPercent : 5;
  const duplicateWindowMs = clampInt(o.duplicateWindowMs, 0, 60000, 350);
  // Max. Zeitabstand zweier HP-Proben, damit ein HP-Anstieg noch als Heilung
  // (statt Monsterwechsel) gilt. Groessere Luecken = Ziel verloren/gewechselt.
  const hpHealMaxGapMs = clampInt(o.hpHealMaxGapMs, 600, 30000, 4000);
  const logger = typeof o.logger === 'function' ? o.logger : null;

  // ── interner Zustand ──────────────────────────────────────────────────────
  const sessionId = formatSessionId(Date.now());
  const baseName = `killfeed-debug-${sessionId}`;
  let partIndex = 1;
  let currentFile = null;
  let currentBytes = 0;
  let needsMeta = true;

  let seq = 0;
  const ring = [];           // Live-Ringpuffer (Objekte, fuer query/summary)
  let pending = [];          // noch nicht geschriebene NDJSON-Zeilen (Strings)
  let flushing = false;
  let flushPromise = null;   // laufender Flush — damit flush()/dispose() darauf warten koennen
  let flushTimer = null;
  let disposed = false;

  let scanCounter = 0;

  // Pro-Profil-Zustand fuer Anomalie-Erkennung.
  // profileId -> { lastScan, entities: Map, monsters: Map, lastKillTs }
  const profiles = new Map();

  const stats = {
    sessionId,
    startedAt: isoTimestamp(Date.now()),
    recorded: 0,
    dropped: 0,
    flushes: 0,
    bytesWritten: 0,
    archives: 0,
    byKind: {},
    anomalies: 0,
    lastError: null,
  };

  function getProfile(profileId) {
    const key = profileId || '__global__';
    let p = profiles.get(key);
    if (!p) {
      p = { lastScan: null, entities: new Map(), monsters: new Map(), lastKillTs: 0 };
      profiles.set(key, p);
    }
    return p;
  }

  // ── Schreibpfad: gepuffert + asynchron ───────────────────────────────────

  /** Haengt ein fertiges Event in Ring + Flush-Queue. Niemals blockierend. */
  function emit(event) {
    if (!enabled || disposed) return null;
    event.seq = ++seq;
    stats.recorded++;
    stats.byKind[event.event] = (stats.byKind[event.event] || 0) + 1;
    if (event.flags && event.flags.length) stats.anomalies++;

    ring.push(event);
    if (ring.length > maxRamEntries) ring.shift();

    try {
      pending.push(JSON.stringify(event) + '\n');
    } catch (_) {
      // zirkulaere/kaputte Referenz — defensiv ignorieren
      return event;
    }
    if (pending.length > MAX_PENDING_LINES) {
      const drop = pending.length - MAX_PENDING_LINES;
      pending.splice(0, drop);
      stats.dropped += drop;
    }
    if (pending.length >= flushBatchSize) {
      // Fire-and-forget: kein await im Aufruferpfad.
      doFlush();
    }
    return event;
  }

  function metaLine() {
    return JSON.stringify({
      event: 'meta',
      timestamp: isoTimestamp(Date.now()),
      seq: 0,
      schema_version: SCHEMA_VERSION,
      session: sessionId,
      part: partIndex,
      generator: 'killfeed/debug_recorder',
      note:
        'NDJSON: eine JSON-Zeile pro Event. event-Typen: meta|scan|kill|kill_rollback|anomaly. ' +
        'hp-Felder sind [current,max]. exp-Werte sind Prozent (0..100). Zeitstempel ISO-8601.',
      config: { scanSampleRate, dedupeScans, epsilon, suspectThreshold, maxFileBytes, maxArchives },
    }) + '\n';
  }

  /**
   * Schreibt die offene Queue asynchron auf die Platte. Laeuft bereits ein
   * Flush, wird dessen Promise zurueckgegeben — so koennen flush()/dispose()
   * zuverlaessig auf den Abschluss warten (kein Datenverlust durch Races).
   * @returns {Promise<void>}
   */
  function doFlush() {
    if (!enabled || disposed) return Promise.resolve();
    if (flushing) return flushPromise || Promise.resolve();
    if (pending.length === 0) return Promise.resolve();

    flushing = true;
    const batch = pending;
    pending = [];
    let body = batch.join('');
    const consumedMeta = needsMeta;
    if (needsMeta) {
      body = metaLine() + body;
      needsMeta = false;
    }

    flushPromise = (async () => {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        if (!currentFile) {
          currentFile = path.join(dir, `${baseName}-p${String(partIndex).padStart(3, '0')}.ndjson`);
          currentBytes = 0;
        }
        await fs.promises.appendFile(currentFile, body, 'utf8');
        const written = Buffer.byteLength(body);
        currentBytes += written;
        stats.flushes++;
        stats.bytesWritten += written;
        if (currentBytes >= maxFileBytes) {
          await rotate();
        }
      } catch (err) {
        // Schreiben fehlgeschlagen → Batch zurueck in die Queue (begrenzt).
        pending = batch.concat(pending);
        if (consumedMeta) needsMeta = true; // Meta-Zeile beim naechsten Versuch erneut voranstellen
        if (pending.length > MAX_PENDING_LINES) {
          const drop = pending.length - MAX_PENDING_LINES;
          pending.splice(0, drop);
          stats.dropped += drop;
        }
        stats.lastError = String((err && err.message) || err);
        if (logger) logger(`[DebugRecorder] flush failed: ${stats.lastError}`);
      } finally {
        flushing = false;
      }
    })();
    return flushPromise;
  }

  /** Schliesst die aktuelle Datei, gzippt sie im Hintergrund, oeffnet die naechste. */
  async function rotate() {
    const finished = currentFile;
    partIndex += 1;
    currentFile = path.join(dir, `${baseName}-p${String(partIndex).padStart(3, '0')}.ndjson`);
    currentBytes = 0;
    needsMeta = true;
    if (finished) {
      gzipFile(finished).catch((err) => {
        if (logger) logger(`[DebugRecorder] gzip failed: ${(err && err.message) || err}`);
      });
    }
  }

  async function gzipFile(filePath) {
    const raw = await fs.promises.readFile(filePath);
    const gz = await new Promise((resolve, reject) => {
      zlib.gzip(raw, { level: 6 }, (err, buf) => (err ? reject(err) : resolve(buf)));
    });
    await fs.promises.writeFile(filePath + '.gz', gz);
    await fs.promises.unlink(filePath).catch(() => {});
    stats.archives++;
    await pruneArchives();
  }

  /** Loescht die aeltesten .gz-Archive, sobald mehr als maxArchives vorliegen. */
  async function pruneArchives() {
    try {
      const files = (await fs.promises.readdir(dir))
        .filter((f) => f.startsWith('killfeed-debug-') && f.endsWith('.ndjson.gz'));
      if (files.length <= maxArchives) return;
      const withTime = [];
      for (const f of files) {
        try {
          const st = await fs.promises.stat(path.join(dir, f));
          withTime.push({ f, t: st.mtimeMs });
        } catch (_) { /* ignorieren */ }
      }
      withTime.sort((a, b) => a.t - b.t);
      const toDelete = withTime.slice(0, withTime.length - maxArchives);
      for (const { f } of toDelete) {
        await fs.promises.unlink(path.join(dir, f)).catch(() => {});
      }
    } catch (_) { /* Verzeichnis evtl. noch leer */ }
  }

  // ── Anomalie-Erkennung ────────────────────────────────────────────────────

  /**
   * Flags fuer einen Scan ermitteln. Erkennt:
   *  - exp_out_of_range   : EXP-% ausserhalb 0..100
   *  - exp_negative       : EXP unter dem Vorwert auf gleichem Level (Drop)
   *  - hp_regression      : Monster-HP ohne Kill gestiegen (Heilung/Respawn/Bug)
   *  - exp_gain_no_kill   : EXP gestiegen, ohne dass ein Kill erfasst wurde (Scan/Quest/verpasst)
   */
  function detectScanFlags(p, scan, now) {
    const flags = [];
    if (scan.player && Number.isFinite(scan.player.exp_percent)) {
      const e = scan.player.exp_percent;
      if (e < 0 || e > 100) flags.push('exp_out_of_range');
    }
    const prev = p.lastScan;
    if (prev && scan.player && prev.player && Number.isFinite(scan.player.exp_percent) && Number.isFinite(prev.player.exp_percent)) {
      const dExp = scan.player.exp_percent - prev.player.exp_percent;
      const sameLevel = scan.player.level === prev.player.level;
      if (sameLevel && dExp < -epsilon && scan.player.exp_percent > 1) {
        flags.push('exp_negative');
      }
      // EXP gestiegen, aber seit dem letzten Scan kein Kill registriert.
      if (sameLevel && dExp > epsilon && p.lastKillTs <= (prev._t || 0)) {
        flags.push('exp_gain_no_kill');
      }
    }
    // HP-Regression: gleiche Entity, HP mitten im Kampf gestiegen, kein Kill
    // dazwischen. Da Monster-IDs Typ-IDs sind (kein Instanz-Identifier), wird
    // ein Zielwechsel zwischen gleichartigen Monstern ausgeblendet: ein neu
    // anvisiertes/respawntes Monster zeigt ~volle HP → nur ein Anstieg, der
    // UNTER dem Vollwert bleibt, gilt als verdaechtige Heilung.
    if (scan.entity && scan.entity.hp && scan.entity._key) {
      const ent = p.entities.get(scan.entity._key);
      if (ent && ent.hist.length) {
        const last = ent.hist[ent.hist.length - 1];
        const cur = scan.entity.hp[0];
        const max = scan.entity.hp[1] || ent.max || 0;
        const gapMs = now - last.t;
        if (
          max > 0 &&
          cur - last.c > max * 0.05 &&
          cur < max * 0.95 &&
          gapMs <= hpHealMaxGapMs &&
          p.lastKillTs < last.t
        ) {
          flags.push('hp_regression');
        }
      }
    }
    return flags;
  }

  /**
   * Flags fuer einen Kill ermitteln. Erkennt:
   *  - zero_exp          : Kill praktisch ohne EXP-Zuwachs
   *  - exp_jump          : EXP-Sprung ueber suspectThreshold
   *  - exp_outlier       : Einzel-Kill-EXP ueber killOutlierPercent (unplausibel gross)
   *  - lump_split        : OCR-Haenger, mehrere Kills in einem Tick (killCount > 1)
   *  - possible_duplicate: gleiches Monster erneut innerhalb duplicateWindowMs
   *  - exp_deviation     : Einzel-Kill-EXP weicht stark vom laufenden Median ab
   */
  function detectKillFlags(p, monsterName, deltaExp, killCount, unitExp, now) {
    const flags = [];
    if (!(deltaExp > epsilon)) flags.push('zero_exp');
    if (deltaExp > suspectThreshold) flags.push('exp_jump');
    // Unplausibel grosser Einzel-Kill — auch unterhalb von suspectThreshold.
    // Braucht keine Historie → greift schon beim allerersten Kill (z.B. einem
    // OCR-Baseline-Glitch direkt nach Session-Reset).
    if (unitExp > killOutlierPercent) flags.push('exp_outlier');
    if (killCount > 1) flags.push('lump_split');

    const lastTs = p.monsters.get(monsterName) && p.monsters.get(monsterName).lastKillTs;
    if (lastTs && now - lastTs <= duplicateWindowMs) flags.push('possible_duplicate');

    // Laufenden Median der Einzel-Kill-EXP pro Monster pflegen.
    let m = p.monsters.get(monsterName);
    if (!m) { m = { units: [], lastKillTs: 0 }; p.monsters.set(monsterName, m); }
    if (unitExp > 0 && m.units.length >= 4) {
      const med = median(m.units);
      if (med > 0 && Math.abs(unitExp - med) / med > 0.4) flags.push('exp_deviation');
    }
    if (unitExp > 0) {
      m.units.push(unitExp);
      if (m.units.length > 21) m.units.shift();
    }
    m.lastKillTs = now;
    return flags;
  }

  // ── oeffentliche record*-API ──────────────────────────────────────────────

  /**
   * Live-OCR-Scan erfassen (Level/EXP/Gegner-Level/Element/HP).
   * @param {object} d
   * @param {string} d.profileId
   * @param {number} d.ts            - Tick-Zeitstempel (ms)
   * @param {number} [d.level]       - Spieler-Level
   * @param {number} [d.exp]         - Spieler-EXP in %
   * @param {number} [d.rmExp]       - RM-EXP in % (Side-Channel)
   * @param {object} [d.monster]     - { id, name, level, element, hp:{current,max} }
   */
  function recordScan(d) {
    if (!enabled || disposed || !d) return null;
    const now = Number.isFinite(d.ts) ? d.ts : Date.now();
    const p = getProfile(d.profileId);

    const m = d.monster || null;
    let entity = null;
    if (m && (m.id || m.name)) {
      const key = String(m.id || m.name);
      entity = {
        id: m.id || null,
        name: m.name || null,
        level: Number.isFinite(m.level) ? m.level : null,
        element: m.element || null,
        hp: m.hp && Number.isFinite(m.hp.current) ? [m.hp.current, m.hp.max] : null,
        _key: key,
      };
    }

    const scan = {
      event: 'scan',
      timestamp: isoTimestamp(now),
      _t: now,
      profile: d.profileId || null,
      player: {
        level: Number.isFinite(d.level) ? d.level : null,
        exp_percent: Number.isFinite(d.exp) ? round(d.exp, 4) : null,
        rm_exp: Number.isFinite(d.rmExp) ? round(d.rmExp, 4) : null,
      },
      entity: entity,
      flags: [],
    };
    scan.flags = detectScanFlags(p, scan, now);

    // HP-Historie der Entity fortschreiben (auch wenn der Scan selbst nicht
    // geloggt wird — damit Kill-Events eine vollstaendige Historie bekommen).
    if (entity && entity.hp) {
      let ent = p.entities.get(entity._key);
      if (!ent) {
        ent = { id: entity.id, name: entity.name, level: entity.level, element: entity.element, max: entity.hp[1], hist: [] };
        p.entities.set(entity._key, ent);
        if (p.entities.size > 200) {
          // aelteste Entity verdraengen (Map behaelt Einfuegereihenfolge)
          const oldest = p.entities.keys().next().value;
          p.entities.delete(oldest);
        }
      }
      // Nur echte HP-AENDERUNGEN aufnehmen — sonst fuellt sich die Historie
      // bei stabiler HP mit Dubletten und verliert ihre Aussagekraft.
      const lastH = ent.hist[ent.hist.length - 1];
      if (!lastH || lastH.c !== entity.hp[0] || lastH.m !== entity.hp[1]) {
        ent.hist.push({ t: now, c: entity.hp[0], m: entity.hp[1] });
        if (ent.hist.length > hpHistoryLen) ent.hist.shift();
      }
    }

    // Dedup: unveraenderter Folge-Scan ohne Flags wird nicht geloggt.
    const prev = p.lastScan;
    const unchanged =
      dedupeScans && prev && scan.flags.length === 0 &&
      prev.player.level === scan.player.level &&
      prev.player.exp_percent === scan.player.exp_percent &&
      prev.player.rm_exp === scan.player.rm_exp &&
      sameEntity(prev.entity, scan.entity);

    p.lastScan = scan;

    if (unchanged) return null;
    // Sample-Rate: nur jedes N-te Scan-Event — Flags ueberschreiben das Sampling.
    scanCounter += 1;
    if (scan.flags.length === 0 && scanSampleRate > 1 && (scanCounter % scanSampleRate) !== 0) {
      return null;
    }

    const out = stripInternal(scan);
    return emit(out);
  }

  /**
   * Bestaetigten Kill erfassen.
   * @param {object} d
   * @param {string} d.profileId
   * @param {number} d.ts
   * @param {string} d.monsterName
   * @param {object} [d.monster]   - { id, level, element, rank }
   * @param {number} d.deltaExp    - EXP-Zuwachs in % (Summe ueber killCount)
   * @param {number} [d.killCount=1]
   * @param {number} [d.expectedExp] - erwartete EXP aus der Monster-Tabelle
   * @param {number} [d.level]     - Spieler-Level
   * @param {number} [d.exp]       - Spieler-EXP in % nach dem Kill
   * @param {number} [d.ttkMs]     - Time-to-kill in ms (falls gemessen)
   */
  function recordKill(d) {
    if (!enabled || disposed || !d) return null;
    const now = Number.isFinite(d.ts) ? d.ts : Date.now();
    const p = getProfile(d.profileId);
    const name = d.monsterName || 'Unknown';
    const killCount = Math.max(1, Math.round(d.killCount || 1));
    const deltaExp = Number.isFinite(d.deltaExp) ? d.deltaExp : 0;
    const unitExp = deltaExp / killCount;

    const flags = detectKillFlags(p, name, deltaExp, killCount, unitExp, now);
    p.lastKillTs = now;

    const mInfo = d.monster || {};
    const entKey = String(mInfo.id || name);
    const ent = p.entities.get(entKey);

    const expBlock = {
      delta_percent: round(deltaExp, 4),
      unit_percent: round(unitExp, 4),
      kill_count: killCount,
    };
    if (Number.isFinite(d.expectedExp)) expBlock.expected_percent = round(d.expectedExp, 4);

    const event = {
      event: 'kill',
      timestamp: isoTimestamp(now),
      profile: d.profileId || null,
      entity: {
        id: mInfo.id || null,
        name: name,
        level: Number.isFinite(mInfo.level) ? mInfo.level : null,
        element: mInfo.element || null,
        rank: mInfo.rank || null,
        hp_history: ent ? ent.hist.map((h) => [h.c, h.m]) : [],
      },
      exp: expBlock,
      level_progress: {
        level: Number.isFinite(d.level) ? d.level : null,
        exp_percent: Number.isFinite(d.exp) ? round(d.exp, 4) : null,
        to_level_percent: Number.isFinite(d.exp) ? round(100 - d.exp, 4) : null,
      },
      ttk_ms: Number.isFinite(d.ttkMs) ? Math.round(d.ttkMs) : null,
      flags: flags,
    };
    return emit(event);
  }

  /**
   * Zurueckgerollten Kill erfassen (Nachvalidierung hat den Kill verworfen).
   * @param {object} d  - { profileId, ts, monsterName, monster, deltaExp, killCount, level, reason }
   */
  function recordKillRollback(d) {
    if (!enabled || disposed || !d) return null;
    const now = Number.isFinite(d.ts) ? d.ts : Date.now();
    const killCount = Math.max(1, Math.round(d.killCount || 1));
    const deltaExp = Number.isFinite(d.deltaExp) ? d.deltaExp : 0;
    const mInfo = d.monster || {};
    return emit({
      event: 'kill_rollback',
      timestamp: isoTimestamp(now),
      profile: d.profileId || null,
      entity: {
        id: mInfo.id || null,
        name: d.monsterName || 'Unknown',
        level: Number.isFinite(mInfo.level) ? mInfo.level : null,
        element: mInfo.element || null,
      },
      exp: { delta_percent: round(deltaExp, 4), kill_count: killCount },
      level_progress: { level: Number.isFinite(d.level) ? d.level : null },
      reason: d.reason || 'post_validation_rejected',
      flags: ['rolled_back'],
    });
  }

  /**
   * Freie Anomalie erfassen (fuer Faelle ohne eigenes Kill-/Scan-Event).
   * @param {object} d - { profileId, ts, type, detail }
   */
  function recordAnomaly(d) {
    if (!enabled || disposed || !d) return null;
    const now = Number.isFinite(d.ts) ? d.ts : Date.now();
    return emit({
      event: 'anomaly',
      timestamp: isoTimestamp(now),
      profile: d.profileId || null,
      anomaly: d.type || 'unknown',
      detail: d.detail || {},
      flags: [d.type || 'unknown'],
    });
  }

  // ── Abfrage-API (fuer Live-LLM-Analyse) ───────────────────────────────────

  /**
   * Liefert Events aus dem RAM-Ringpuffer, gefiltert.
   * @param {object} [f]
   * @param {string[]} [f.kinds]      - z.B. ['kill','anomaly']
   * @param {string}   [f.profileId]
   * @param {number}   [f.sinceMs]    - nur Events ab diesem Zeitstempel (ms)
   * @param {boolean}  [f.flaggedOnly]- nur Events mit mind. einem Flag
   * @param {string}   [f.flag]       - nur Events mit diesem Flag
   * @param {number}   [f.limit=500]  - max. Anzahl (neueste zuerst gekuerzt)
   */
  function query(f) {
    const flt = f || {};
    const limit = clampInt(flt.limit, 1, 50000, 500);
    let res = ring;
    if (flt.kinds && flt.kinds.length) {
      const set = new Set(flt.kinds);
      res = res.filter((e) => set.has(e.event));
    }
    if (flt.profileId) res = res.filter((e) => e.profile === flt.profileId);
    if (Number.isFinite(flt.sinceMs)) {
      res = res.filter((e) => Date.parse(e.timestamp) >= flt.sinceMs);
    }
    if (flt.flaggedOnly) res = res.filter((e) => e.flags && e.flags.length);
    if (flt.flag) res = res.filter((e) => e.flags && e.flags.indexOf(flt.flag) !== -1);
    if (res.length > limit) res = res.slice(res.length - limit);
    return res;
  }

  /**
   * Kompakte, LLM-freundliche Zusammenfassung des aktuellen Ringpuffers.
   * Liefert Zaehler, Anomalie-Aufschluesselung und EXP-/Monster-Statistik.
   */
  function summary() {
    const byKind = {};
    const flagTally = {};
    const monsterKills = {};
    const unitByMonster = {};
    let minExp = Infinity;
    let maxExp = -Infinity;
    let firstTs = null;
    let lastTs = null;

    for (const e of ring) {
      byKind[e.event] = (byKind[e.event] || 0) + 1;
      if (e.flags) for (const fl of e.flags) flagTally[fl] = (flagTally[fl] || 0) + 1;
      if (!firstTs) firstTs = e.timestamp;
      lastTs = e.timestamp;
      if (e.event === 'kill') {
        const n = e.entity && e.entity.name;
        if (n) {
          monsterKills[n] = (monsterKills[n] || 0) + (e.exp ? e.exp.kill_count : 1);
          (unitByMonster[n] = unitByMonster[n] || []).push(e.exp ? e.exp.unit_percent : 0);
        }
      }
      if (e.event === 'scan' && e.player && Number.isFinite(e.player.exp_percent)) {
        minExp = Math.min(minExp, e.player.exp_percent);
        maxExp = Math.max(maxExp, e.player.exp_percent);
      }
    }
    const monsters = Object.keys(monsterKills).map((n) => ({
      name: n,
      kills: monsterKills[n],
      median_unit_exp: round(median(unitByMonster[n]), 4),
    })).sort((a, b) => b.kills - a.kills);

    return {
      session: sessionId,
      generated_at: isoTimestamp(Date.now()),
      ring_size: ring.length,
      ring_capacity: maxRamEntries,
      window: { from: firstTs, to: lastTs },
      events_by_kind: byKind,
      anomaly_flags: flagTally,
      exp_range_percent: minExp <= maxExp ? [round(minExp, 4), round(maxExp, 4)] : null,
      monsters: monsters,
      io: {
        recorded: stats.recorded,
        dropped: stats.dropped,
        flushes: stats.flushes,
        bytes_written: stats.bytesWritten,
        archives: stats.archives,
        pending_lines: pending.length,
        last_error: stats.lastError,
      },
    };
  }

  /**
   * Statistischer Deep-Pass ("Stufe 2"): wertet ALLE Events des Fensters aus —
   * nicht nur geflaggte — und macht so auch Fehler sichtbar, fuer die es kein
   * festes Flag gibt. Liefert einen kompakten Zahlen-Digest + `findings`-Liste
   * (LLM-freundlich, token-sparend; die Roh-Events bleiben aussen vor).
   *
   * Heuristiken: EXP-Verteilung/IQR-Ausreisser pro Monster, EXP-Bilanz pro
   * Level-Abschnitt (Σ Kill-Delta vs. gemessene EXP-Differenz), EXP-Monotonie,
   * Timeline-Luecken (OCR-Haenger), Kill-Rate, Unknown-Quote, Kill-Abstaende.
   *
   * @param {object} [f]
   * @param {number} [f.minutes]  - Fensterbreite in Minuten (Default 60)
   * @param {number} [f.sinceMs]  - alternativ: Startzeitpunkt (ms)
   * @param {boolean}[f.full]     - true = gesamten Ringpuffer auswerten
   */
  function analyze(f) {
    const flt = f || {};
    const now = Date.now();
    let sinceMs;
    if (Number.isFinite(flt.sinceMs)) sinceMs = flt.sinceMs;
    else if (Number.isFinite(flt.minutes)) sinceMs = now - flt.minutes * 60000;
    else if (flt.full) sinceMs = 0;
    else sinceMs = now - 60 * 60000; // Default: letzte Stunde

    const ev = ring
      .filter((e) => e.event !== 'meta' && Date.parse(e.timestamp) >= sinceMs)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const kills = ev.filter((e) => e.event === 'kill');
    const scans = ev.filter((e) => e.event === 'scan');
    const findings = [];

    if (ev.length === 0) {
      return {
        generated_at: isoTimestamp(now),
        window: { from: isoTimestamp(sinceMs), to: isoTimestamp(now), minutes: round((now - sinceMs) / 60000, 1) },
        events: 0,
        findings: ['Keine Events im Fenster.'],
      };
    }

    const times = ev.map((e) => Date.parse(e.timestamp));
    const spanMin = (times[times.length - 1] - times[0]) / 60000;

    // ── EXP-Verteilung + IQR-Ausreisser pro Monster ──────────────────────────
    const perMon = {};
    for (const k of kills) {
      const n = (k.entity && k.entity.name) || 'Unknown';
      (perMon[n] = perMon[n] || []).push(k.exp ? k.exp.unit_percent : 0);
    }
    const monsters = [];
    for (const name of Object.keys(perMon)) {
      const s = perMon[name].slice().sort((a, b) => a - b);
      const q1 = quantile(s, 0.25);
      const q3 = quantile(s, 0.75);
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const outliers = s.filter((v) => v < lo || v > hi);
      monsters.push({
        name,
        kills: s.length,
        unit_exp: {
          min: round(s[0], 4), q1: round(q1, 4), median: round(quantile(s, 0.5), 4),
          q3: round(q3, 4), max: round(s[s.length - 1], 4),
        },
        outliers: outliers.map((v) => round(v, 4)),
      });
      if (outliers.length) {
        findings.push(`${name}: ${outliers.length} EXP-Ausreisser ggü. eigener Verteilung (${outliers.map((v) => round(v, 4)).join(', ')} %)`);
      }
    }
    monsters.sort((a, b) => b.kills - a.kills);

    // ── EXP-Bilanz je Level-Abschnitt ────────────────────────────────────────
    // Bei lueckenloser Zaehlung gilt: exp(letzter Kill) − exp(vor erstem Kill)
    // == Σ aller Kill-Deltas. Jede Abweichung = nicht erfasster / falscher Kill
    // (oder EXP-Bewegung ohne Kill, z.B. Scan-Baseline-Korrektur).
    const balance = [];
    let runLevel = null;
    let runKills = [];
    const flushRun = () => {
      if (runKills.length >= 2) {
        const first = runKills[0];
        const last = runKills[runKills.length - 1];
        const fe = first.level_progress && first.level_progress.exp_percent;
        const le = last.level_progress && last.level_progress.exp_percent;
        const fd = first.exp && first.exp.delta_percent;
        if ([fe, le, fd].every(Number.isFinite)) {
          const measured = le - (fe - fd);
          const sumDelta = runKills.reduce((s, k) => s + (k.exp ? k.exp.delta_percent : 0), 0);
          const disc = round(measured - sumDelta, 4);
          balance.push({
            level: runLevel, kills: runKills.length,
            sum_delta: round(sumDelta, 4), measured_delta: round(measured, 4), discrepancy: disc,
          });
          if (Math.abs(disc) > 0.01) {
            findings.push(`EXP-Bilanz Lvl ${runLevel}: Σ Kill-Delta ${round(sumDelta, 4)} % vs. gemessen ${round(measured, 4)} % → Diff ${disc} % (verpasste/falsche Kills?)`);
          }
        }
      }
      runKills = [];
    };
    for (const k of kills) {
      const lv = k.level_progress && k.level_progress.level;
      if (lv !== runLevel) { flushRun(); runLevel = lv; }
      runKills.push(k);
    }
    flushRun();

    // ── EXP-Monotonie (gleiche Stufe darf nicht zurueckspringen) ─────────────
    let monoViolations = 0;
    let worstDrop = 0;
    const lastExpByLevel = {};
    for (const e of ev) {
      let lv, exp;
      if (e.event === 'kill') { lv = e.level_progress && e.level_progress.level; exp = e.level_progress && e.level_progress.exp_percent; }
      else if (e.event === 'scan') { lv = e.player && e.player.level; exp = e.player && e.player.exp_percent; }
      else continue;
      if (!Number.isFinite(lv) || !Number.isFinite(exp)) continue;
      const prev = lastExpByLevel[lv];
      if (prev !== undefined && exp < prev - epsilon) {
        monoViolations++;
        if (prev - exp > worstDrop) worstDrop = prev - exp;
      }
      lastExpByLevel[lv] = exp;
    }
    if (worstDrop > 1) {
      findings.push(`EXP-Monotonie: ${monoViolations} Rückwärts-Sprünge auf gleicher Stufe, größter ${round(worstDrop, 4)} % (OCR-Spike oder Bug)`);
    }

    // ── Timeline-Luecken (OCR-Haenger / AFK) ─────────────────────────────────
    const gaps = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    const gapsSorted = gaps.slice().sort((a, b) => a - b);
    const gapMed = median(gapsSorted);
    const stallThreshold = Math.max(8000, gapMed * 4);
    const stalls = gaps.filter((g) => g > stallThreshold).length;
    if (stalls > 0) {
      findings.push(`${stalls} Timeline-Lücke(n) > ${Math.round(stallThreshold / 1000)} s (OCR-Hänger/AFK — relevant fürs Lump-Splitting)`);
    }

    // ── Kill-Rate (gesamt + 5-Min-Buckets) ───────────────────────────────────
    const killsPerMin = spanMin > 0 ? kills.length / spanMin : 0;
    const buckets = {};
    for (const k of kills) {
      const b = Math.floor((Date.parse(k.timestamp) - times[0]) / 300000);
      buckets[b] = (buckets[b] || 0) + (k.exp ? k.exp.kill_count : 1);
    }
    const bucketVals = Object.values(buckets);

    // ── Unknown-Quote + Kill-Abstaende ───────────────────────────────────────
    const unknown = kills.filter((k) => !k.entity || !k.entity.name || k.entity.name === 'Unknown').length;
    const unknownRatio = kills.length ? round(unknown / kills.length, 3) : 0;
    if (unknownRatio > 0.15 && kills.length >= 10) {
      findings.push(`Unknown-Quote ${Math.round(unknownRatio * 100)} % — viele Kills ohne aufgelöstes Monster (umgehen die EXP-Tabellen-Validierung)`);
    }
    const kt = kills.map((k) => Date.parse(k.timestamp));
    const inter = [];
    for (let i = 1; i < kt.length; i++) inter.push(kt[i] - kt[i - 1]);
    const interSorted = inter.slice().sort((a, b) => a - b);

    // ── geflaggte Events im Fenster ──────────────────────────────────────────
    const flagTally = {};
    for (const e of ev) {
      if (e.flags) for (const fl of e.flags) flagTally[fl] = (flagTally[fl] || 0) + 1;
    }
    for (const [fl, n] of Object.entries(flagTally)) {
      findings.push(`Flag "${fl}": ${n}× im Fenster`);
    }

    if (findings.length === 0) {
      findings.push('Keine Auffälligkeiten in den Standard-Heuristiken.');
    }

    return {
      generated_at: isoTimestamp(now),
      window: {
        from: isoTimestamp(times[0]), to: isoTimestamp(times[times.length - 1]),
        minutes: round(spanMin, 1),
      },
      events: ev.length,
      kills: kills.length,
      scans: scans.length,
      kill_rate: {
        per_min: round(killsPerMin, 2),
        buckets_5min: bucketVals,
        min_bucket: bucketVals.length ? Math.min(...bucketVals) : 0,
        max_bucket: bucketVals.length ? Math.max(...bucketVals) : 0,
      },
      monsters: monsters,
      exp_balance: balance,
      monotonicity: { violations: monoViolations, worst_drop_percent: round(worstDrop, 4) },
      timeline: {
        gap_median_ms: Math.round(gapMed),
        gap_p95_ms: Math.round(quantile(gapsSorted, 0.95)),
        gap_max_ms: gapsSorted.length ? gapsSorted[gapsSorted.length - 1] : 0,
        stalls: stalls,
      },
      unknown_ratio: unknownRatio,
      inter_kill_ms: {
        min: interSorted.length ? interSorted[0] : null,
        median: interSorted.length ? Math.round(median(interSorted)) : null,
      },
      flags: flagTally,
      findings: findings,
    };
  }

  /** Roh-Statistik (fuer status-IPC). */
  function getStats() {
    return Object.assign({}, stats, {
      enabled,
      ringSize: ring.length,
      pendingLines: pending.length,
      currentFile: currentFile ? path.basename(currentFile) : null,
      dir,
    });
  }

  // ── Lebenszyklus ──────────────────────────────────────────────────────────

  function start() {
    if (!enabled || disposed || flushTimer) return;
    flushTimer = setInterval(() => { doFlush(); }, flushIntervalMs);
    // Verhindert, dass das Intervall den Prozess am Beenden hindert.
    if (flushTimer.unref) flushTimer.unref();
  }

  /**
   * Wartet auf einen evtl. laufenden Flush UND leert die restliche Queue.
   * Schleife, weil waehrend eines Flush neue Events hinzukommen koennen und
   * `doFlush()` bei laufendem Flush nur das in-flight-Promise zurueckgibt.
   */
  async function drain() {
    for (let i = 0; i < 10000; i++) {
      await doFlush();
      if (!flushing && pending.length === 0) break;
    }
  }

  /** Erzwingt einen sofortigen Flush und wartet darauf (z.B. fuer IPC/Shutdown). */
  async function flush() {
    await drain();
    return getStats();
  }

  /** Stoppt den Recorder, schreibt den Rest weg. */
  async function dispose() {
    if (disposed) return;
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    // Disposed-Flag erst NACH dem letzten Flush setzen, sonst No-Op.
    try {
      await drain();
    } catch (_) { /* ignorieren */ }
    disposed = true;
  }

  start();

  return {
    enabled,
    recordScan,
    recordKill,
    recordKillRollback,
    recordAnomaly,
    query,
    summary,
    analyze,
    getStats,
    flush,
    dispose,
  };
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function clampInt(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function formatSessionId(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function sameEntity(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const hpA = a.hp ? a.hp.join('/') : '';
  const hpB = b.hp ? b.hp.join('/') : '';
  return a.id === b.id && a.name === b.name && hpA === hpB;
}

/** Entfernt interne (mit _ praefigierte) Felder vor dem Persistieren/Emit. */
function stripInternal(scan) {
  const out = {
    event: scan.event,
    timestamp: scan.timestamp,
    profile: scan.profile,
    player: scan.player,
    flags: scan.flags,
  };
  if (scan.entity) {
    out.entity = {
      id: scan.entity.id,
      name: scan.entity.name,
      level: scan.entity.level,
      element: scan.entity.element,
      hp: scan.entity.hp,
    };
  } else {
    out.entity = null;
  }
  return out;
}

module.exports = { createDebugRecorder, SCHEMA_VERSION, isoTimestamp };
