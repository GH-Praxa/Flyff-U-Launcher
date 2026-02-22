const fs = require('fs');
const path = require('path');
const d = path.join(process.env.APPDATA, 'Flyff-U-Launcher', 'user', 'cache', 'item', 'item_parameter');
const files = fs.readdirSync(d).filter(f => f.endsWith('.json'));
const rarities = new Map();
const examples = new Map();
for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
    const r = j.rarity || '(none)';
    rarities.set(r, (rarities.get(r) || 0) + 1);
    if (!examples.has(r)) {
      const name = typeof j.name === 'object' ? (j.name.en || Object.values(j.name)[0]) : j.name;
      examples.set(r, `${f} -> ${name}`);
    }
  } catch (e) {}
}
for (const [r, c] of [...rarities.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${c}\t${r}\t(e.g. ${examples.get(r)})`);
}
