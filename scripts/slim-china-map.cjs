/**
 * china-map.json 瘦身：坐标精度裁到 3 位小数（~100m，省级地图缩放级别视觉无损）
 * + 合并相邻重复点。幂等可重跑；重跑只影响 src/data/china-map.json。
 * 用法：node scripts/slim-china-map.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'src', 'data', 'china-map.json');
const raw = fs.readFileSync(file, 'utf8');
const map = JSON.parse(raw);

const round = (n) => Math.round(n * 1000) / 1000;

function slimCoords(coords) {
  if (typeof coords[0] === 'number') {
    return [round(coords[0]), round(coords[1])];
  }
  const out = [];
  let prev = null;
  for (const c of coords) {
    const s = slimCoords(c);
    if (prev && prev[0] === s[0] && prev[1] === s[1]) {
      continue; // 精度裁剪后相邻重复点合并
    }
    prev = s;
    out.push(s);
  }
  return out;
}

function countPoints(c) {
  if (typeof c[0] === 'number') return 1;
  return c.reduce((n, x) => n + countPoints(x), 0);
}

let beforePoints = 0;
let afterPoints = 0;
let deduped = 0;
for (const f of map.features ?? []) {
  const g = f.geometry;
  if (!g) continue;
  const b = countPoints(g.coordinates);
  g.coordinates = slimCoords(g.coordinates);
  const a = countPoints(g.coordinates);
  beforePoints += b;
  afterPoints += a;
  deduped += b - a;
}

const out = JSON.stringify(map);
fs.writeFileSync(file, out);
console.log(
  `china-map.json slimmed: ${(raw.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB, ` +
    `points ${beforePoints} -> ${afterPoints} (merged ${deduped})`,
);
