#!/usr/bin/env node
/**
 * Aggregiert Monster-Stammdaten (Name, Level, Element, Rank) aus den
 * Monster-Parameter-Dateien und schreibt eine kompakte Referenzdatei.
 *
 * Standardquelle:
 *   %AppData%/Flyff-U-Launcher/api_fetch/monster/monster_parameter
 *
 * Umgebungsschalter:
 *   MONSTER_PARAM_DIR  - alternative Quelle
 *   MONSTER_REF_OUT    - Zielpfad (Standard: ./monster_reference.json)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const paramDir =
    process.env.MONSTER_PARAM_DIR ||
    path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "Flyff-U-Launcher",
        "api_fetch",
        "monster",
        "monster_parameter"
    );

const outFile =
    process.env.MONSTER_REF_OUT ||
    path.join(process.cwd(), "monster_reference.json");

const localePriority = [
    "de",
    "en",
    "fr",
    "sp",
    "br",
    "ru",
    "jp",
    "kr",
    "cns",
    "cn",
    "tw",
    "pl",
    "id",
    "it",
    "nl",
    "fi",
    "sw",
    "th",
    "vi",
];

function pickName(nameField) {
    if (!nameField) return "";
    if (typeof nameField === "string") return nameField;
    if (typeof nameField === "object") {
        for (const loc of localePriority) {
            if (nameField[loc]) return String(nameField[loc]);
        }
        const first = Object.values(nameField)[0];
        if (first) return String(first);
    }
    return "";
}

function loadMonsters(dir) {
    const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
        .map((e) => e.name);

    const records = [];
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const raw = fs.readFileSync(fullPath, "utf-8");
            const data = JSON.parse(raw);
            const id = typeof data.id === "number" ? data.id : Number(path.parse(file).name);
            const name = pickName(data.name);
            const level = typeof data.level === "number" ? data.level : null;
            const element = typeof data.element === "string" ? data.element : null;
            const rank = typeof data.rank === "string" ? data.rank : null;
            const hp = typeof data.hp === "number" ? data.hp : null;

            records.push({ id, name, level, element, rank, hp });
        } catch (err) {
            console.error("[export-monster-reference] Fehler bei", file, err.message);
        }
    }

    records.sort((a, b) => {
        if (a.level === b.level) return String(a.name).localeCompare(String(b.name));
        if (a.level === null) return 1;
        if (b.level === null) return -1;
        return a.level - b.level;
    });

    return records;
}

function main() {
    if (!fs.existsSync(paramDir)) {
        console.error("[export-monster-reference] Quelle nicht gefunden:", paramDir);
        process.exit(1);
    }

    const monsters = loadMonsters(paramDir);
    fs.writeFileSync(outFile, JSON.stringify(monsters, null, 2), "utf-8");
    console.log(
        `[export-monster-reference] Fertig: ${monsters.length} Einträge -> ${outFile}`
    );
}

main();
