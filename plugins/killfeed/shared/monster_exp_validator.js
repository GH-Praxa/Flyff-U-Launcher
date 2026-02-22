const path = require('path');
const fs = require('fs/promises');

// Monster EXP table loader.
// Pre-loads all tables eagerly at startup for instant validation.
// Falls back to parallel bulk-load on cache miss.

let baseDir = null;
let fileListPromise = null;
let preloadPromise = null;
const nameToId = new Map();   // lower-case name -> id
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
        if (normalized && !nameToId.has(normalized)) {
          nameToId.set(normalized, id);
        }
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

async function findTableByName(monsterName) {
  const normalized = normalizeName(monsterName);
  if (!normalized || missingNames.has(normalized)) return null;

  // Fast path: already in cache
  const knownId = nameToId.get(normalized);
  if (knownId) {
    return loadTableById(knownId);
  }

  // Slow path: bulk-load all remaining files in parallel (not one-by-one)
  await preloadAll();

  const mappedId = nameToId.get(normalized);
  if (mappedId) {
    return idToTable.get(mappedId) || null;
  }

  missingNames.add(normalized);
  return null;
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
  const table = await findTableByName(monsterName);
  if (!table) return null;
  const idx = Math.max(0, Math.min(table.length - 1, Math.round(level) - 1));
  const expected = table[idx];
  if (!Number.isFinite(expected) || expected <= 0) return null;

  // Accept up to 10x the table value; otherwise treat as outlier.
  if (deltaExp <= expected * 10) return true;
  return false;
}

module.exports = {
  init,
  isWithinAllowed,
  preloadAll,
};
