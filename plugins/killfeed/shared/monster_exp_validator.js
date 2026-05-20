const path = require('path');
const fs = require('fs/promises');

// Monster EXP table loader.
// Pre-loads all tables eagerly at startup for instant validation.
// Falls back to parallel bulk-load on cache miss.

let baseDir = null;
let fileListPromise = null;
let preloadPromise = null;
// lower-case name -> Set<id>. Wichtig als Set, weil mehrere Monster den
// gleichen lokalisierten Namen teilen koennen (z.B. drei "Tempelwächter"
// mit IDs 4282/2567/16430 und stark unterschiedlichen EXP-Tabellen).
// isWithinAllowed muss alle Homonyme pruefen.
const nameToIds = new Map();
const idToTable = new Map();  // id -> numeric array
const missingNames = new Set();

function init(userDataPath) {
  baseDir = path.join(userDataPath, 'user', 'cache', 'monster', 'monster_parameter');
}

async function getFileList() {
  if (!baseDir) return [];
  if (!fileListPromise) {
    fileListPromise = fs.readdir(baseDir).catch(() => []);
  }
  return fileListPromise;
}

function normalizeName(name) {
  return (name || '').toString().trim().toLowerCase();
}

async function loadTableById(id) {
  if (idToTable.has(id)) return idToTable.get(id);
  try {
    const raw = await fs.readFile(path.join(baseDir, `${id}.json`), 'utf-8');
    const obj = JSON.parse(raw);
    const table = Array.isArray(obj.experienceTable)
      ? obj.experienceTable.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : null;
    if (!table || table.length === 0) {
      idToTable.set(id, null);
      return null;
    }
    idToTable.set(id, table);
    if (obj.name && typeof obj.name === 'object') {
      for (const val of Object.values(obj.name)) {
        const normalized = normalizeName(val);
        if (!normalized) continue;
        let bucket = nameToIds.get(normalized);
        if (!bucket) {
          bucket = new Set();
          nameToIds.set(normalized, bucket);
        }
        bucket.add(id);
      }
    }
    return table;
  } catch {
    idToTable.set(id, null);
    return null;
  }
}

/**
 * Eagerly load ALL monster tables into memory.
 * After this completes, all lookups are pure in-memory Map hits (< 1ms).
 * Safe to call multiple times; concurrent calls share the same Promise.
 */
async function preloadAll() {
  if (!baseDir) return;
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const files = await getFileList();
    const ids = files
      .filter(f => f.toLowerCase().endsWith('.json'))
      .map(f => path.basename(f, '.json'));
    // Load all files in parallel (I/O-bound, benefits from concurrency)
    await Promise.all(ids.map(id => loadTableById(id)));
  })();
  return preloadPromise;
}

/** Liefert alle Tabellen, deren lokalisierte Namen mit `monsterName`
 *  uebereinstimmen (Homonym-bewusst). Bei z.B. drei "Tempelwächter"-Monstern
 *  bekommt der Caller alle drei Tabellen und kann ueber Plausibilitaet
 *  entscheiden. Returns [] when nothing matches.
 *
 *  Wichtig: preloadAll() wird IMMER abgewartet, weil sonst nameToIds nur
 *  partiell befuellt waere (z.B. nur die zuerst per ID gesuchten Monster),
 *  und Homonyme uebersehen wuerden. preloadAll cached den Promise, nach dem
 *  ersten Lauf ist es ein No-Op. */
async function findTablesByName(monsterName) {
  const normalized = normalizeName(monsterName);
  if (!normalized || missingNames.has(normalized)) return [];

  await preloadAll();

  const ids = nameToIds.get(normalized);
  if (!ids || ids.size === 0) {
    missingNames.add(normalized);
    return [];
  }

  const tables = [];
  for (const id of ids) {
    const t = idToTable.get(id);
    if (t) tables.push(t);
  }
  return tables;
}

/**
 * Validate whether a deltaExp is within the allowed range for the monster/level.
 * Returns:
 *  - true  => within range (or no data)
 *  - false => clear outlier
 *  - null  => no data available, skip check
 */
async function isWithinAllowed(monsterName, level, deltaExp) {
  if (!baseDir) return null;
  if (!monsterName || !Number.isFinite(level) || !Number.isFinite(deltaExp)) return null;
  const tables = await findTablesByName(monsterName);
  if (!tables.length) return null;

  const idx = Math.max(0, Math.min(199, Math.round(level) - 1));
  // Akzeptiere, wenn deltaExp gegen IRGENDEINE der Homonym-Tabellen plausibel
  // ist. Tempelwächter@Lvl133 hat 3 ID-Varianten mit expected ∈ {0.001, 0.286, 0}.
  // Mit `findTableByName` (alt) bekamen wir nur die erste ID → 0.001 → 0.0319
  // wurde geblockt obwohl der User die 0.286-Variante killte. Hier nehmen wir
  // den MAX expected ueber alle gueltigen Tabellen, multipliziert mit Toleranz.
  let bestExpected = 0;
  for (const table of tables) {
    const e = table[Math.min(idx, table.length - 1)];
    if (Number.isFinite(e) && e > bestExpected) bestExpected = e;
  }
  if (bestExpected <= 0) return null; // keine Datenbasis → skip check

  // Toleranzfaktor: Die Tabellenwerte sind deutlich kleiner als der echte
  // EXP-Gewinn pro Kill (Server-EXP-Rate). Reale Messungen zeigen ~20-30x
  // gegenueber der Tabelle (z. B. Small Tigar Tabelle 0,0031 % vs. real
  // ~0,06-0,10 %). Plus Lump-Splitting ~10x. x40 cappte legitime Lumps und
  // verursachte stille Kill-Verluste (siehe DEV-NOTES, exp_gain_no_kill-Bug).
  // x400 deckt Server-Multiplikator + Lumps ab; grobe Ausreisser fallen
  // weiter durch den engine-internen suspectThreshold (40 % deltaExp).
  // Muss konsistent zur killValidator-Decke in main.js sein.
  if (deltaExp <= bestExpected * 400) return true;
  return false;
}

module.exports = {
  init,
  isWithinAllowed,
  preloadAll,
};
