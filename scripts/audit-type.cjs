/** audit-type.cjs — 排版度量审计：display ≤ 6rem / prefers-reduced-motion / 正文容器宽度 */
const fs = require('fs');
const { execSync } = require('child_process');
const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
  .filter(f => /^src\/.*\.(vue|css)$/.test(f));

let over6rem = [];
let reducedMotion = [];
let containers = [];

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  // 1. font-size 超 6rem（96px）
  for (const m of s.matchAll(/font-size\s*:\s*([\d.]+rem|[\d.]+px)/g)) {
    const v = m[1];
    const px = v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v);
    if (px > 96) over6rem.push(`${f}: ${v}`);
  }
  // 2. prefers-reduced-motion
  if (/prefers-reduced-motion/.test(s)) reducedMotion.push(f);
  // 3. 正文容器 max-w（阅读页）
  if (/max-w-(2xl|3xl|4xl|5xl|6xl|7xl)/.test(s) && /text-(sm|base|lg)\s/.test(s)) {
    for (const m of s.matchAll(/max-w-(\d?xl)/g)) {
      containers.push(`${f}: max-w-${m[1]}`);
    }
  }
}

console.log('--- display 超 6rem（96px） ---');
console.log(over6rem.length ? over6rem.join('\n') : '无');
console.log('\n--- prefers-reduced-motion 覆盖 ---');
console.log(reducedMotion.length ? reducedMotion.join(', ') : '无');
console.log('\n--- 正文容器宽度（抽查） ---');
console.log([...new Set(containers)].join('\n'));
