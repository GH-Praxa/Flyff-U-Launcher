/**
 * Quest Guide Plugin - Backend
 * Data layer, quest-chain engine, extended IPC handlers, progress & settings.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

let pluginDir = null;
let dataDir = null;
let cacheDir = null;
let ctx = null;
let currentProfileId = null;

const CONCURRENCY_LIMIT = 25;

async function loadInBatches(ids, loadFn) {
    const results = [];
    for (let i = 0; i < ids.length; i += CONCURRENCY_LIMIT) {
        const batch = ids.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.all(batch.map(loadFn));
        results.push(...batchResults);
    }
    return results;
}

const DEFAULT_SETTINGS = {
    levelMode: 'ocr',
    ocrRange: 5,
    manualLevel: 1,
    manualRange: 5,
    minLevel: 1,
    maxLevel: 30,
    showCompleted: false,
    showUnavailable: false,
    language: 'en'
};

// In-memory caches
const questsCache   = { data: null };
const npcsCache     = { data: null };
const monstersCache = { data: null };
const itemsCache    = { data: null };
const progressCache = { data: null };
const settingsCache = { data: null };

// OCR level tracking
let unsubscribeOcr = null;
let lastOcrLevel = null; // most recently detected player level per profile

// Quest-chain graph: questId -> { prev: [ids], next: [ids] }
let chainGraph = null;

// Map window data: token (hex string) -> mapData object.
// Each map window is assigned a unique token placed in its URL hash.
// The window's preload script reads the hash and fetches data via ipcMain.
const mapWindowData = new Map();
const MAP_IPC_CHANNEL = 'questguide:map-data';

// Subcategory detection patterns for repeatable quests
const REPEAT_SUBCATEGORIES = [
    { key: 'raising_pet', patterns: ['raising pet', 'pet aufzucht', 'criando', 'élevage', 'criando tu mascota'] },
    { key: 'collection', patterns: ['collect', 'sammle', 'colete', 'collecte', 'recoge', 'thu thập'] },
    { key: 'monster_hunt', patterns: ['hunt', 'monster', 'kill', 'jagd', 'monstro', 'monstre', 'cazar', 'ล่า'] },
    { key: 'delivery', patterns: ['delivery', 'deliver', 'liefer', 'entregue', 'livraison', 'entrega', 'ส่ง'] },
];

function detectSubcategory(quest) {
    if (quest.type !== 'repeat') return null;
    const name = getLocalizedName(quest, 'en').toLowerCase();
    for (const cat of REPEAT_SUBCATEGORIES) {
        for (const pattern of cat.patterns) {
            if (name.includes(pattern)) return cat.key;
        }
    }
    return 'other';
}

// ─── Logging ────────────────────────────────────────────────────────────────

function log(msg, ...args) {
    if (ctx?.logger?.info) ctx.logger.info(msg, ...args);
    else console.log('[QuestGuide]', msg, ...args);
}

function logErr(msg, ...args) {
    if (ctx?.logger?.error) ctx.logger.error(msg, ...args);
    else console.error('[QuestGuide]', msg, ...args);
}

// ─── File helpers ───────────────────────────────────────────────────────────

async function loadJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = await fsp.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        logErr(`Failed to load ${filePath}: ${err.message}`);
        return null;
    }
}

// ─── Data Loaders ───────────────────────────────────────────────────────────

async function loadQuests() {
    if (questsCache.data) return questsCache.data;

    const questDir = path.join(cacheDir, 'quest');
    const questListPath = path.join(questDir, 'quest.json');
    const questList = await loadJsonFile(questListPath);

    if (!questList || !Array.isArray(questList)) {
        log('No quest list found in cache');
        questsCache.data = new Map();
        questsCache.data._noData = true;
        return questsCache.data;
    }

    const map = new Map();
    const questParamDir = path.join(questDir, 'quest_parameter');

    const entries = await loadInBatches(questList, async (questId) => {
        const quest = await loadJsonFile(path.join(questParamDir, `${questId}.json`));
        return quest ? [questId, quest] : null;
    });
    for (const entry of entries) {
        if (entry) map.set(entry[0], entry[1]);
    }

    log(`Loaded ${map.size} quests`);
    questsCache.data = map;
    return map;
}

async function loadNpcs() {
    if (npcsCache.data) return npcsCache.data;

    const npcDir = path.join(cacheDir, 'npc');
    const npcListPath = path.join(npcDir, 'npc.json');
    const npcList = await loadJsonFile(npcListPath);

    if (!npcList || !Array.isArray(npcList)) {
        npcsCache.data = new Map();
        return npcsCache.data;
    }

    const map = new Map();
    const npcParamDir = path.join(npcDir, 'npc_parameter');

    const entries = await loadInBatches(npcList, async (npcId) => {
        const npc = await loadJsonFile(path.join(npcParamDir, `${npcId}.json`));
        return npc ? [npcId, npc] : null;
    });
    for (const entry of entries) {
        if (entry) map.set(entry[0], entry[1]);
    }

    log(`Loaded ${map.size} NPCs`);
    npcsCache.data = map;
    return map;
}

async function loadMonsters() {
    if (monstersCache.data) return monstersCache.data;

    const monsterDir = path.join(cacheDir, 'monster');
    const monsterListPath = path.join(monsterDir, 'monster.json');
    const monsterList = await loadJsonFile(monsterListPath);

    if (!monsterList || !Array.isArray(monsterList)) {
        monstersCache.data = new Map();
        return monstersCache.data;
    }

    const map = new Map();
    const monsterParamDir = path.join(monsterDir, 'monster_parameter');

    const entries = await loadInBatches(monsterList, async (monsterId) => {
        const monster = await loadJsonFile(path.join(monsterParamDir, `${monsterId}.json`));
        return monster ? [monsterId, monster] : null;
    });
    for (const entry of entries) {
        if (entry) map.set(entry[0], entry[1]);
    }

    log(`Loaded ${map.size} monsters`);
    monstersCache.data = map;
    return map;
}

async function loadItems() {
    if (itemsCache.data) return itemsCache.data;

    const itemDir = path.join(cacheDir, 'item');
    const itemListPath = path.join(itemDir, 'item.json');
    const itemList = await loadJsonFile(itemListPath);

    if (!itemList || !Array.isArray(itemList)) {
        itemsCache.data = new Map();
        return itemsCache.data;
    }

    const map = new Map();
    const itemParamDir = path.join(itemDir, 'item_parameter');

    const entries = await loadInBatches(itemList, async (itemId) => {
        const item = await loadJsonFile(path.join(itemParamDir, `${itemId}.json`));
        return item ? [itemId, item] : null;
    });
    for (const entry of entries) {
        if (entry) map.set(entry[0], entry[1]);
    }

    log(`Loaded ${map.size} items`);
    itemsCache.data = map;
    return map;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLocalizedName(obj, lang = 'en') {
    if (!obj?.name) return 'Unknown';
    if (typeof obj.name === 'string') return obj.name;
    return obj.name[lang] || obj.name['en'] || Object.values(obj.name)[0] || 'Unknown';
}

function getIconPath(type, id, filename) {
    // Returns absolute path to icon file.
    // For NPCs the icons are stored by their filename field (e.g. "hachal.png"),
    // for items/monsters they are stored by id (e.g. "12345.png").
    const iconDir = path.join(cacheDir, type, 'icons');
    if (filename) {
        const namedPath = path.join(iconDir, filename);
        if (fs.existsSync(namedPath)) return namedPath;
    }
    const pngPath = path.join(iconDir, `${id}.png`);
    if (fs.existsSync(pngPath)) return pngPath;
    // Also try without .png extension in case filename already has it
    if (filename && !filename.endsWith('.png')) {
        const pngPath2 = path.join(iconDir, `${filename}.png`);
        if (fs.existsSync(pngPath2)) return pngPath2;
    }
    return null;
}

function getNpcLocation(npc) {
    // NPC coordinates are stored in a locations[] array, not as direct fields.
    if (!npc) return null;
    const loc = Array.isArray(npc.locations) ? npc.locations[0] : null;
    return loc || null;
}

function getMonsterLocation(monster) {
    // Monster coordinates are in location object (single spawn) or spawns array
    if (!monster) return null;
    // Try direct location field first
    if (monster.location && monster.location.world != null) {
        return {
            world: monster.location.world,
            x: monster.location.x,
            y: monster.location.y,
            z: monster.location.z,
            aggressivity: null,
            spawns: null
        };
    }
    // Try spawns array - use center of first spawn area
    if (Array.isArray(monster.spawns) && monster.spawns.length > 0) {
        const spawn = monster.spawns[0];
        // Calculate average aggressivity across all spawns
        let avgAggro = 0;
        for (const s of monster.spawns) {
            avgAggro += (s.aggressivity || 0);
        }
        avgAggro = Math.round(avgAggro / monster.spawns.length);
        // Collect all spawn areas for map display
        const spawnAreas = monster.spawns.map(s => ({
            left: s.left,
            top: s.top,
            right: s.right,
            bottom: s.bottom,
            aggressivity: s.aggressivity || 0
        }));
        return {
            world: spawn.world,
            x: (spawn.left + spawn.right) / 2,
            z: (spawn.top + spawn.bottom) / 2,
            aggressivity: avgAggro,
            spawns: spawnAreas
        };
    }
    return null;
}

// ─── Quest Chain Engine ─────────────────────────────────────────────────────

async function buildChainGraph() {
    if (chainGraph) return chainGraph;

    const quests = await loadQuests();
    const graph = new Map(); // questId -> { prev: Set, next: Set }

    // Initialize nodes
    for (const [id] of quests) {
        graph.set(id, { prev: new Set(), next: new Set() });
    }

    // Build edges from beginQuests (prerequisites)
    for (const [id, quest] of quests) {
        if (quest.beginQuests && quest.beginQuests.length > 0) {
            for (const pr of quest.beginQuests) {
                const prevId = pr.quest;
                const node = graph.get(id);
                if (node) node.prev.add(prevId);
                const prevNode = graph.get(prevId);
                if (prevNode) prevNode.next.add(id);
            }
        }
    }

    chainGraph = graph;
    log('Chain graph built');
    return graph;
}

async function getChain(questId) {
    const graph = await buildChainGraph();
    const quests = await loadQuests();
    const quest = quests.get(questId);
    if (!quest || quest.type !== 'chain') return null;

    // Walk backward to find root
    const visited = new Set();
    let rootId = questId;

    function findRoot(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = graph.get(id);
        if (!node || node.prev.size === 0) {
            rootId = id;
            return;
        }
        // Follow first prev (chains are linear)
        for (const prevId of node.prev) {
            const prevQuest = quests.get(prevId);
            if (prevQuest && prevQuest.type === 'chain') {
                findRoot(prevId);
                return;
            }
        }
        rootId = id;
    }
    findRoot(questId);

    // Walk forward from root
    const chain = [];
    const chainVisited = new Set();

    function walkForward(id) {
        if (chainVisited.has(id)) return;
        chainVisited.add(id);
        const q = quests.get(id);
        if (!q) return;
        chain.push({
            id: id,
            name: getLocalizedName(q),
            minLevel: q.minLevel,
            current: id === questId
        });
        const node = graph.get(id);
        if (!node) return;
        for (const nextId of node.next) {
            const nextQuest = quests.get(nextId);
            if (nextQuest && nextQuest.type === 'chain') {
                walkForward(nextId);
            }
        }
    }
    walkForward(rootId);

    // Derive chain name from root quest
    const rootQuest = quests.get(rootId);
    const chainName = rootQuest ? getLocalizedName(rootQuest) : 'Unknown Chain';

    return { chain, chainName };
}

// ─── Progress & Settings ────────────────────────────────────────────────────

async function loadProgress() {
    if (progressCache.data) return progressCache.data;
    const progressPath = path.join(dataDir, 'progress.json');
    try {
        if (fs.existsSync(progressPath)) {
            const content = await fsp.readFile(progressPath, 'utf-8');
            progressCache.data = JSON.parse(content);
            return progressCache.data;
        }
    } catch (err) {
        logErr(`Failed to load progress: ${err.message}`);
    }
    progressCache.data = {};
    return progressCache.data;
}

async function saveProgress(data) {
    const progressPath = path.join(dataDir, 'progress.json');
    try {
        await fsp.mkdir(dataDir, { recursive: true });
        await fsp.writeFile(progressPath, JSON.stringify(data, null, 2), 'utf-8');
        progressCache.data = data;
    } catch (err) {
        logErr(`Failed to save progress: ${err.message}`);
        throw err;
    }
}

async function getProfileProgress(profileId) {
    const all = await loadProgress();
    return all[profileId] || {};
}

async function setQuestProgress(profileId, questId, completed) {
    const all = await loadProgress();
    if (!all[profileId]) all[profileId] = {};
    all[profileId][questId.toString()] = completed;
    await saveProgress(all);
    return all[profileId];
}

async function resetProfileProgress(profileId) {
    const all = await loadProgress();
    delete all[profileId];
    await saveProgress(all);
}

async function loadSettings() {
    if (settingsCache.data) return settingsCache.data;
    const settingsPath = path.join(dataDir, 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const content = await fsp.readFile(settingsPath, 'utf-8');
            settingsCache.data = { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
            return settingsCache.data;
        }
    } catch (err) {
        logErr(`Failed to load settings: ${err.message}`);
    }
    settingsCache.data = { ...DEFAULT_SETTINGS };
    return settingsCache.data;
}

async function saveSettings(settings) {
    const current = await loadSettings();
    const updated = { ...current, ...settings };
    const settingsPath = path.join(dataDir, 'settings.json');
    try {
        await fsp.mkdir(dataDir, { recursive: true });
        await fsp.writeFile(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
        settingsCache.data = updated;
        return updated;
    } catch (err) {
        logErr(`Failed to save settings: ${err.message}`);
        throw err;
    }
}

// ─── Region Extraction ──────────────────────────────────────────────────────

async function getRegions(lang = 'en') {
    const npcs = await loadNpcs();
    if (!npcs || npcs.size === 0) {
        return [];
    }
    
    const worldIds = new Set();
    for (const [, npc] of npcs) {
        const loc = getNpcLocation(npc);
        if (loc?.world != null) {
            worldIds.add(loc.world);
        }
    }

    const regions = [];
    for (const worldId of worldIds) {
        try {
            const worldData = await loadJsonFile(
                path.join(cacheDir, 'world', 'world_parameter', `${worldId}.json`)
            );
            let name = String(worldId);
            if (worldData?.name) {
                name = worldData.name[lang] || worldData.name['en'] || Object.values(worldData.name)[0] || name;
            }
            regions.push({ id: worldId, name: name });
        } catch (err) {
            // If world file can't be loaded, use ID as name
            regions.push({ id: worldId, name: String(worldId) });
        }
    }

    regions.sort((a, b) => a.name.localeCompare(b.name));
    return regions;
}

// ─── Extended Quest List ────────────────────────────────────────────────────

async function getQuestList(options, progress, lang = 'en') {
    const quests = await loadQuests();
    const npcs = await loadNpcs();
    const monsters = await loadMonsters();
    const items = await loadItems();

    // playerLevel is the actual character level (for availability checks).
    // rangeLow / rangeHigh define the visible window (for the level-range filter).
    const playerLevel = options.playerLevel ?? options.minLevel ?? 1;
    const rangeLow    = options.minLevel ?? 1;
    const rangeHigh   = options.maxLevel ?? 190;
    const searchTerm = (options.search || '').toLowerCase().trim();
    const regionFilter = options.region || '';
    const typeFilter = (options.type || 'all').toLowerCase();
    const subcategoryFilter = options.subcategory || null;

    const result = [];
    const subcategories = new Set();
    let chainCount = 0;

    for (const [questId, quest] of quests) {
        const completed = progress[questId.toString()] === true;
        if (completed && !options.showCompleted) continue;

        // Skip category container quests that have no level data (they're chapter groupings, not actual quests)
        if (quest.minLevel === undefined || quest.maxLevel === undefined) continue;

        // Level filter
        if (quest.minLevel > rangeHigh) continue;
        if (quest.maxLevel < rangeLow) continue;

        // Type filter
        if (typeFilter === 'chain' && quest.type !== 'chain') continue;
        if (typeFilter === 'category' && quest.type !== 'category') continue;
        if (typeFilter === 'daily' && quest.type !== 'daily') continue;
        if (typeFilter === 'repeat' && quest.type !== 'repeat') continue;

        // Subcategory detection for repeat quests
        const subcategory = detectSubcategory(quest);
        if (subcategory) subcategories.add(subcategory);
        if (subcategoryFilter && subcategory !== subcategoryFilter) continue;

        const beginNpc = npcs.get(quest.beginNPC);
        const endNpc = npcs.get(quest.endNPC);

        // Region filter
        if (regionFilter !== '' && regionFilter != null) {
            const beginLoc = getNpcLocation(beginNpc);
            const npcWorld = beginLoc?.world;
            // Compare as strings for consistency (handles both numeric and string IDs)
            if (npcWorld == null || String(npcWorld) !== String(regionFilter)) continue;
        }

        // Availability check
        let available = true;
        let unavailableReason = undefined;

        if (quest.minLevel > playerLevel) {
            available = false;
            unavailableReason = `Requires level ${quest.minLevel}`;
        } else if (quest.maxLevel < playerLevel) {
            available = false;
            unavailableReason = `Max level ${quest.maxLevel} exceeded`;
        }

        if (quest.beginQuests && quest.beginQuests.length > 0) {
            const prereqMet = quest.beginQuests.every(pr => progress[pr.quest.toString()] === true);
            if (!prereqMet) {
                available = false;
                const missingPrereq = quest.beginQuests.find(pr => !progress[pr.quest.toString()]);
                if (missingPrereq) {
                    const prereqQuest = quests.get(missingPrereq.quest);
                    const prereqName = prereqQuest ? getLocalizedName(prereqQuest, lang) : `Quest ${missingPrereq.quest}`;
                    unavailableReason = `Requires: ${prereqName}`;
                }
            }
        }

        if (!available && !options.showUnavailable) continue;

        // Text search
        if (searchTerm) {
            const questName = getLocalizedName(quest, lang).toLowerCase();
            const beginNpcName = beginNpc ? getLocalizedName(beginNpc, lang).toLowerCase() : '';
            const endNpcName = endNpc ? getLocalizedName(endNpc, lang).toLowerCase() : '';

            let monsterNames = '';
            if (quest.endKillMonsters) {
                monsterNames = quest.endKillMonsters
                    .flatMap(km => km.monster.map(mId => {
                        const m = monsters.get(mId);
                        return m ? getLocalizedName(m, lang).toLowerCase() : '';
                    }))
                    .join(' ');
            }

            let itemNames = '';
            if (quest.endNeededItems) {
                itemNames += quest.endNeededItems
                    .map(ir => {
                        const item = items.get(ir.item);
                        return item ? getLocalizedName(item, lang).toLowerCase() : '';
                    })
                    .join(' ');
            }
            if (quest.endReceiveItems) {
                itemNames += ' ' + quest.endReceiveItems
                    .map(ir => {
                        const item = items.get(ir.item);
                        return item ? getLocalizedName(item, lang).toLowerCase() : '';
                    })
                    .join(' ');
            }

            const searchable = `${questName} ${beginNpcName} ${endNpcName} ${monsterNames} ${itemNames}`;
            if (!searchable.includes(searchTerm)) continue;
        }

        // Chain info
        let chainInfo = null;
        if (quest.type === 'chain') {
            chainCount++;
            // Lightweight chain info: count beginQuests depth
            const hasPrereq = quest.beginQuests && quest.beginQuests.length > 0;
            chainInfo = { isChain: true, hasPrereq };
        }

        result.push({
            id: questId,
            name: getLocalizedName(quest, lang),
            minLevel: quest.minLevel,
            maxLevel: quest.maxLevel,
            type: quest.type,
            parent: quest.parent,
            repeatable: quest.repeatable,
            subcategory,
            beginNPCName: beginNpc ? getLocalizedName(beginNpc, lang) : quest.beginNPC != null ? `NPC ${quest.beginNPC}` : 'Unknown',
            beginNPCWorld: getNpcLocation(beginNpc)?.world || null,
            endNPCName: endNpc ? getLocalizedName(endNpc, lang) : quest.endNPC != null ? `NPC ${quest.endNPC}` : 'Unknown',
            completed,
            available,
            unavailableReason,
            chainInfo
        });
    }

    result.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.minLevel - b.minLevel;
    });

    const total = result.length;
    const availableCount = result.filter(q => q.available && !q.completed).length;
    const completedCount = result.filter(q => q.completed).length;

    return {
        quests: result,
        stats: { total, available: availableCount, completed: completedCount, chains: chainCount },
        subcategories: Array.from(subcategories)
    };
}

// ─── Extended Quest Detail ──────────────────────────────────────────────────

async function getQuestDetail(questId, profileId, lang = 'en', playerLevel = null) {
    const quests = await loadQuests();
    const quest = quests.get(questId);
    if (!quest) return null;

    const npcs = await loadNpcs();
    const monsters = await loadMonsters();
    const items = await loadItems();
    const progress = profileId ? await getProfileProgress(profileId) : {};

    const detail = {
        id: questId,
        name: getLocalizedName(quest, lang),
        nameObj: quest.name,
        minLevel: quest.minLevel,
        maxLevel: quest.maxLevel,
        type: quest.type,
        parent: quest.parent,
        repeatable: quest.repeatable,
        description: quest.description,
        completed: progress[questId.toString()] === true
    };

    // Begin NPC
    const beginNpc = npcs.get(quest.beginNPC);
    if (beginNpc) {
        const beginLoc = getNpcLocation(beginNpc);
        detail.beginNPC = {
            id: quest.beginNPC,
            name: getLocalizedName(beginNpc, lang),
            world: beginLoc?.world ?? null,
            x: beginLoc?.x ?? null,
            y: beginLoc?.y ?? null,
            z: beginLoc?.z ?? null,
            icon: getIconPath('npc', quest.beginNPC, beginNpc.image)
        };
    }

    // End NPC
    const endNpc = npcs.get(quest.endNPC);
    if (endNpc) {
        const endLoc = getNpcLocation(endNpc);
        detail.endNPC = {
            id: quest.endNPC,
            name: getLocalizedName(endNpc, lang),
            world: endLoc?.world ?? null,
            x: endLoc?.x ?? null,
            y: endLoc?.y ?? null,
            z: endLoc?.z ?? null,
            icon: getIconPath('npc', quest.endNPC, endNpc.image)
        };
    }

    // Monster objectives with icons, levels and locations
    if (quest.endKillMonsters) {
        detail.monsters = quest.endKillMonsters.map(km => {
            const monsterInfos = km.monster.map(mId => {
                const m = monsters.get(mId);
                const loc = getMonsterLocation(m);
                return {
                    id: mId,
                    name: m ? getLocalizedName(m, lang) : `Monster ${mId}`,
                    level: m?.level ?? null,
                    icon: getIconPath('monster', mId, m?.icon || m?.image),
                    world: loc?.world ?? null,
                    x: loc?.x ?? null,
                    z: loc?.z ?? null,
                    aggressivity: loc?.aggressivity ?? null,
                    spawns: loc?.spawns ?? null
                };
            });
            return { monsters: monsterInfos, count: km.count };
        });
    }

    // Needed items with icons
    if (quest.endNeededItems) {
        detail.neededItems = quest.endNeededItems.map(ir => {
            const item = items.get(ir.item);
            return {
                id: ir.item,
                name: item ? getLocalizedName(item, lang) : `Item ${ir.item}`,
                count: ir.count,
                icon: getIconPath('item', ir.item, item?.icon || item?.image)
            };
        });
    }

    // Reward items with icons
    if (quest.endReceiveItems) {
        detail.rewardItems = quest.endReceiveItems.map(ir => {
            const item = items.get(ir.item);
            return {
                id: ir.item,
                name: item ? getLocalizedName(item, lang) : `Item ${ir.item}`,
                count: ir.count,
                icon: getIconPath('item', ir.item, item?.icon || item?.image)
            };
        });
    }

    // Gold & EXP
    detail.gold = quest.endReceiveGold || 0;
    detail.totalExp = 0;
    detail.maxExp = 0;
    detail.playerLevel = playerLevel || quest.minLevel || 1;
    
    if (quest.endReceiveExperience && quest.endReceiveExperience.length > 0) {
        const expTable = quest.endReceiveExperience;
        const maxIdx = Math.max(0, (quest.minLevel || 1) - 1);
        const playerIdx = Math.max(0, (playerLevel || quest.minLevel || 1) - 1);
        
        const expAtPlayerLevel = expTable[playerIdx];
        const expAtMinLevel = expTable[maxIdx];
        
        detail.totalExp = typeof expAtPlayerLevel === 'number' ? expAtPlayerLevel : 0;
        detail.maxExp = typeof expAtMinLevel === 'number' ? expAtMinLevel : 0;
    }

    // Prerequisites with completion status
    if (quest.beginQuests && quest.beginQuests.length > 0) {
        detail.prerequisites = quest.beginQuests.map(pr => {
            const prereqQuest = quests.get(pr.quest);
            return {
                id: pr.quest,
                name: prereqQuest ? getLocalizedName(prereqQuest, lang) : `Quest ${pr.quest}`,
                completed: progress[pr.quest.toString()] === true
            };
        });
    }

    // Follow-up quests: quests that have THIS quest as a prerequisite
    const followUps = [];
    for (const [fId, fQuest] of quests) {
        if (fQuest.beginQuests) {
            for (const pr of fQuest.beginQuests) {
                if (pr.quest === questId) {
                    followUps.push({
                        id: fId,
                        name: getLocalizedName(fQuest, lang)
                    });
                    break;
                }
            }
        }
    }
    if (followUps.length > 0) detail.followUpQuests = followUps;

    // Chain data (if chain quest)
    if (quest.type === 'chain') {
        const chainData = await getChain(questId);
        if (chainData) {
            // Add completion status to chain
            chainData.chain.forEach(c => {
                c.completed = progress[c.id.toString()] === true;
            });
            detail.chain = chainData;
        }
    }

    return detail;
}

// ─── Quick Search ───────────────────────────────────────────────────────────

async function quickSearch(query, limit = 10, lang = 'en') {
    const quests = await loadQuests();
    const npcs = await loadNpcs();
    const term = query.toLowerCase().trim();
    if (!term) return [];

    const results = [];
    for (const [questId, quest] of quests) {
        if (quest.minLevel === undefined || quest.maxLevel === undefined) continue;
        const name = getLocalizedName(quest, lang).toLowerCase();
        const beginNpc = npcs.get(quest.beginNPC);
        const npcName = beginNpc ? getLocalizedName(beginNpc, lang).toLowerCase() : '';

        if (name.includes(term) || npcName.includes(term)) {
            results.push({
                id: questId,
                name: getLocalizedName(quest, lang),
                minLevel: quest.minLevel,
                type: quest.type,
                npcName: beginNpc ? getLocalizedName(beginNpc, lang) : null
            });
            if (results.length >= limit) break;
        }
    }
    return results;
}

// ─── Cache Clear ────────────────────────────────────────────────────────────

function clearCache() {
    questsCache.data = null;
    npcsCache.data = null;
    monstersCache.data = null;
    itemsCache.data = null;
    progressCache.data = null;
    settingsCache.data = null;
    chainGraph = null;
    log('Cache cleared');
}

// ─── Module Exports (Plugin Lifecycle) ──────────────────────────────────────

module.exports = {
    async init(context) {
        ctx = context;
        pluginDir = context.pluginDir;
        dataDir = context.dataDir;

        const userDataPath = dataDir.replace(/[/\\]user[/\\]plugin-data[/\\]questguide$/, '');
        cacheDir = path.join(userDataPath, 'user', 'cache');

        log('Initializing Quest Guide v2');
        log(`Plugin dir: ${pluginDir}`);
        log(`Data dir: ${dataDir}`);
        log(`Cache dir: ${cacheDir}`);

        // Profile tracking
        if (context.services?.profiles) {
            try {
                const overlayTargetId = await context.services.profiles.getOverlayTargetId();
                if (overlayTargetId) currentProfileId = overlayTargetId;

                context.services.profiles.onProfileChanged((profiles) => {
                    const overlayTarget = profiles.find(p => p.overlayTarget);
                    if (overlayTarget) {
                        currentProfileId = overlayTarget.id;
                        log(`Profile changed: ${currentProfileId}`);
                        // Broadcast level update so UI reloads quest list
                        if (lastOcrLevel) {
                            ctx.ipc.broadcast('quest:level:update', { profileId: currentProfileId, level: lastOcrLevel });
                        }
                        // Broadcast profile change so frontend can clear its detail cache
                        ctx.ipc.broadcast('quest:profile:changed', { profileId: currentProfileId });
                    }
                });
            } catch (err) {
                logErr(`Failed to get profiles: ${err.message}`);
            }
        }

        // ── IPC: quest:list ─────────────────────────────────────────────
        context.ipc.handle('quest:list', async (_event, args) => {
            const profileId = args?.profileId || currentProfileId;
            if (!profileId) return { error: 'No profile selected' };

            const settings = await loadSettings();
            const progress = await getProfileProgress(profileId);

            const options = {
                minLevel: args?.minLevel,
                maxLevel: args?.maxLevel,
                playerLevel: args?.playerLevel,
                showCompleted: args?.showCompleted ?? settings.showCompleted,
                showUnavailable: args?.showUnavailable ?? settings.showUnavailable,
                search: args?.search,
                region: args?.region,
                type: args?.type
            };

            try {
                const quests = await loadQuests();
                if (quests.size === 0 && quests._noData) {
                    return {
                        success: true,
                        data: { quests: [], stats: { total: 0, available: 0, completed: 0, chains: 0 }, noData: true },
                        quests: [],
                        stats: { total: 0, available: 0, completed: 0, chains: 0 },
                        noData: true,
                        profileId
                    };
                }
                const result = await getQuestList(options, progress, settings.language);
                return { ...result, profileId };
            } catch (err) {
                logErr(`quest:list error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:detail ───────────────────────────────────────────
        context.ipc.handle('quest:detail', async (_event, args) => {
            const questId = args?.questId;
            if (!questId) return { error: 'questId required' };

            const profileId = args?.profileId || currentProfileId;
            const playerLevel = args?.playerLevel || null;
            const settings = await loadSettings();

            try {
                const detail = await getQuestDetail(questId, profileId, settings.language, playerLevel);
                return { detail };
            } catch (err) {
                logErr(`quest:detail error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:chain ────────────────────────────────────────────
        context.ipc.handle('quest:chain', async (_event, args) => {
            const questId = args?.questId;
            if (!questId) return { error: 'questId required' };

            try {
                const chainData = await getChain(questId);
                if (!chainData) return { chain: null };

                const profileId = args?.profileId || currentProfileId;
                if (profileId) {
                    const progress = await getProfileProgress(profileId);
                    chainData.chain.forEach(c => {
                        c.completed = progress[c.id.toString()] === true;
                    });
                }
                return chainData;
            } catch (err) {
                logErr(`quest:chain error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:search ───────────────────────────────────────────
        context.ipc.handle('quest:search', async (_event, args) => {
            const query = args?.query || '';
            const limit = args?.limit || 10;
            const settings = await loadSettings();

            try {
                const results = await quickSearch(query, limit, settings.language);
                return { results };
            } catch (err) {
                logErr(`quest:search error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:regions ──────────────────────────────────────────
        context.ipc.handle('quest:regions', async () => {
            try {
                const settings = await loadSettings();
                const regions = await getRegions(settings.language);
                return { regions };
            } catch (err) {
                logErr(`quest:regions error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:progress:get ─────────────────────────────────────
        context.ipc.handle('quest:progress:get', async (_event, args) => {
            const profileId = args?.profileId || currentProfileId;
            if (!profileId) return { error: 'No profile selected' };

            try {
                const progress = await getProfileProgress(profileId);
                return { progress, profileId };
            } catch (err) {
                logErr(`quest:progress:get error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:progress:set ─────────────────────────────────────
        context.ipc.handle('quest:progress:set', async (_event, args) => {
            const profileId = args?.profileId || currentProfileId;
            const questId = args?.questId;
            const completed = args?.completed;

            if (!profileId) return { error: 'No profile selected' };
            if (questId === undefined) return { error: 'questId required' };
            if (completed === undefined) return { error: 'completed required' };

            try {
                const progress = await setQuestProgress(profileId, questId, completed);
                return { success: true, progress, profileId };
            } catch (err) {
                logErr(`quest:progress:set error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:progress:reset ───────────────────────────────────
        context.ipc.handle('quest:progress:reset', async (_event, args) => {
            try {
                if (args?.profileId) {
                    await resetProfileProgress(args.profileId);
                    return { success: true, profileId: args.profileId };
                } else {
                    await saveProgress({});
                    return { success: true, all: true };
                }
            } catch (err) {
                logErr(`quest:progress:reset error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:settings:get ─────────────────────────────────────
        context.ipc.handle('quest:settings:get', async () => {
            try {
                const settings = await loadSettings();
                return { settings };
            } catch (err) {
                logErr(`quest:settings:get error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:settings:set ─────────────────────────────────────
        context.ipc.handle('quest:settings:set', async (_event, args) => {
            try {
                const settings = await saveSettings(args || {});
                return { success: true, settings };
            } catch (err) {
                logErr(`quest:settings:set error: ${err.message}`);
                return { error: err.message };
            }
        });

        // ── IPC: quest:ocr:level ────────────────────────────────────────
        // Returns the last OCR-detected player level (so UI can query on open)
        context.ipc.handle('quest:ocr:level', async () => {
            return { level: lastOcrLevel };
        });

        // ── ipcMain: questguide:map-data ────────────────────────────────
        // Called by the map window's preload (map_preload.js) to fetch init data.
        // The token (from URL hash) identifies which window's data to return.
        {
            const { ipcMain } = require('electron');
            ipcMain.removeHandler(MAP_IPC_CHANNEL);
            ipcMain.handle(MAP_IPC_CHANNEL, (_event, token) => {
                return mapWindowData.get(token) || null;
            });
        }

        // ── IPC: quest:map:open ─────────────────────────────────────────
        // Opens a separate BrowserWindow with an interactive tile map centered
        // on the NPC position. worldId identifies which world_parameter to load.
        context.ipc.handle('quest:map:open', async (_event, args) => {
            const { worldId, x, z, npcName, spawns } = args || {};
            if (worldId == null) return { error: 'worldId required' };

            try {
                const { BrowserWindow } = require('electron');

                const worldData = await loadJsonFile(
                    path.join(cacheDir, 'world', 'world_parameter', `${worldId}.json`)
                );
                if (!worldData) return { error: `World ${worldId} not found in cache` };

                const tileName  = worldData.tileName  || '';
                const tileSize  = worldData.tileSize   || 512;
                const mapWidth  = worldData.width      || 10752;
                const mapHeight = worldData.height     || 8192;

                let worldName = String(worldId);
                if (worldData.name) {
                    worldName = worldData.name.en
                        || worldData.name[Object.keys(worldData.name)[0]]
                        || worldName;
                }

                const label   = npcName ? String(npcName) : 'NPC';
                const npcIcon = args.npcIcon ? String(args.npcIcon) : null;

                const mapData = {
                    tileName,
                    tileSize,
                    mapWidth,
                    mapHeight,
                    x:         Math.round(x  || 0),
                    z:         Math.round(z  || 0),
                    npcName:   label,
                    worldName,
                    cacheDir,
                    npcIcon,
                    spawns: spawns || null
                };

                // Assign a unique token so the preload can fetch the right dataset.
                // Token is placed in the URL hash; the preload reads window.location.hash.
                const token = require('crypto').randomBytes(6).toString('hex');
                mapWindowData.set(token, mapData);

                const win = new BrowserWindow({
                    width: 900,
                    height: 700,
                    title: `NPC Location – ${label}`,
                    backgroundColor: '#1a1a2e',
                    webPreferences: {
                        preload: path.join(pluginDir, 'map_preload.js'),
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false
                    }
                });
                win.setMenu(null);
                win.once('closed', () => mapWindowData.delete(token));

                // Pass the token via hash; the preload reads window.location.hash.slice(1)
                win.loadFile(path.join(pluginDir, 'ui_map.html'), { hash: token });

                // Ensure window stays on top and is focused after content loads
                win.once('ready-to-show', () => {
                    win.setAlwaysOnTop(true, 'floating');
                    win.moveTop();
                    win.focus();
                    // Disable always-on-top after a short delay so user can interact with game
                    setTimeout(() => win.setAlwaysOnTop(false), 500);
                });

                return { success: true };
            } catch (err) {
                logErr(`quest:map:open error: ${err.message}`);
                return { error: err.message };
            }
        });

        log('Quest Guide v2 initialized');
    },

    async start() {
        // Subscribe to OCR updates to auto-detect player level
        if (ctx?.eventBus?.on) {
            unsubscribeOcr = ctx.eventBus.on('core:ocr:update', (payload) => {
                const { profileId, values } = payload || {};
                if (!profileId || !values || !values.lvl) return;
                const lvl = parseInt(values.lvl, 10);
                if (isNaN(lvl) || lvl <= 0 || lvl > 300) return;
                if (lvl === lastOcrLevel) return; // no change
                lastOcrLevel = lvl;
                ctx.ipc.broadcast('quest:level:update', { profileId, level: lvl });
            });
            log('Quest Guide started - OCR level tracking active');
        } else {
            log('Quest Guide started - no eventBus available, OCR level tracking disabled');
        }
    },

    async stop() {
        if (unsubscribeOcr) {
            unsubscribeOcr();
            unsubscribeOcr = null;
        }
        lastOcrLevel = null;
        mapWindowData.clear();
        try {
            const { ipcMain } = require('electron');
            ipcMain.removeHandler(MAP_IPC_CHANNEL);
        } catch (_) {}
        clearCache();
        log('Quest Guide stopped');
    }
};
