const d = require('./app/src/data/monster_reference.json');
const ranks = {};
d.forEach(m => { ranks[m.rank] = (ranks[m.rank] || 0) + 1; });
console.log('Rank distribution:', JSON.stringify(ranks, null, 2));

const noEl = d.filter(m => m.element === 'none').length;
console.log('No element:', noEl, 'of', d.length);

const withEl = d.filter(m => m.element !== 'none');
const byLvlEl = {};
withEl.forEach(m => {
    const k = m.level + '-' + m.element;
    if (!byLvlEl[k]) byLvlEl[k] = [];
    byLvlEl[k].push(m.name + ' (' + m.rank + ')');
});
const uniq = Object.entries(byLvlEl).filter(e => e[1].length === 1).length;
const amb = Object.entries(byLvlEl).filter(e => e[1].length > 1);
console.log('With element: unique:', uniq, 'ambiguous:', amb.length);
amb.slice(0, 15).forEach(e => console.log('  ', e[0], ':', e[1].join(', ')));

// Check how many normal-rank monsters exist
const normalRank = d.filter(m => m.rank === 'normal');
console.log('\nNormal-rank monsters:', normalRank.length);
const normalByLvlEl = {};
normalRank.filter(m => m.element !== 'none').forEach(m => {
    const k = m.level + '-' + m.element;
    if (!normalByLvlEl[k]) normalByLvlEl[k] = [];
    normalByLvlEl[k].push(m.name);
});
const normalUniq = Object.entries(normalByLvlEl).filter(e => e[1].length === 1).length;
const normalAmb = Object.entries(normalByLvlEl).filter(e => e[1].length > 1);
console.log('Normal+element: unique:', normalUniq, 'ambiguous:', normalAmb.length);
normalAmb.forEach(e => console.log('  ', e[0], ':', e[1].join(', ')));
