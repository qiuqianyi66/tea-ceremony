const fs = require('fs');
const { execSync } = require('child_process');
const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
  .filter(f => /^src\/.*\.(ts|vue|css)$/.test(f));
const counts = {};
const byFile = {};
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const hexes = [...s.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toUpperCase());
  for (const h of hexes) {
    counts[h] = (counts[h] || 0) + 1;
    (byFile[h] = byFile[h] || []).push(f);
  }
}
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log('硬编码 6 位 hex 总出现:', sorted.reduce((a, [, n]) => a + n, 0), '种:', sorted.length);
const palette = new Set(['#FAF6F0', '#F5F0E8', '#3D3225', '#5D4E37', '#7E6A55', '#9E8050']);
console.log('--- 非色板 hex（不在 6 令牌中）---');
for (const [h, n] of sorted) {
  if (!palette.has(h)) console.log(h.padEnd(8), String(n).padEnd(4), byFile[h].slice(0, 3).join(', '));
}
