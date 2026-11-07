/**
 * 技能调用统计：消费 `.harness/changes/{feat}/summary.md` 的「调用技能」表格行。
 * 目的：让「哪个技能真被用过」有据可查，替代「按 README 是否列出」判死活的印象式治理。
 *
 * 判据分级（避免把「没留痕」误读成「未调用」）：
 *   - 未知技能名 = error（写错名字会静默失效，必须响亮）
 *   - 历史切片无该行 = 仅统计，不报错（38 个老切片不回填，缺记录不等于没用过）
 *
 * 表格行格式（模板已内置）：| 调用技能 | `skill-a`、`skill-b`（无则写「无」） |
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseSkillNames } = require('./skill-usage-parse.cjs');

const ROOT = path.resolve(__dirname, '..');
const CHANGES = path.join(ROOT, '.harness', 'changes');

// F3：新切片必须留痕。38 个历史切片建立时模板还没有「调用技能」行，回填不了，
// 所以按「首次入库日期」分档：ENFORCE_SINCE 及之后新增的切片缺该行 = error，之前只统计。
const ENFORCE_SINCE = '2026-11-07';
function firstAddDate(rel) {
  try {
    const out = execSync(`git log --diff-filter=A --format=%aI -- "${rel}"`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? out.split('\n').pop().slice(0, 10) : '';
  } catch {
    return ''; // 无 git / 浅克隆：取证不到就不阻断，降级为只统计
  }
}
const FAMILIES = ['main-dev', 'biz-dev', 'trouble-shooting', 'prompt-templates'];
const SKILL_ROOTS = [
  path.join(ROOT, '.agents', 'skills'),
  ...FAMILIES.map((f) => path.join(ROOT, '.harness', 'skills', f)),
];

function knownSkills() {
  const paths = new Map();
  let dirs = 0;
  for (const dir of SKILL_ROOTS) {
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md'))) {
        dirs++;
        const key = e.name.replace(/^\d{2}-/, '');
        const rel = path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/');
        if (!paths.has(key)) paths.set(key, []);
        paths.get(key).push(rel);
      }
    }
  }
  // 同名跨根会让两个不同技能被统计成同一个名字，必须显式列出而不是只报数量
  const dup = [...paths].filter(([, v]) => v.length > 1);
  return { names: new Set(paths.keys()), dirs, dup };
}

const { names: known, dirs, dup } = knownSkills();
const counts = new Map();
const unknown = [];
const noRecord = [];
const enforced = [];
let slices = 0;
let recorded = 0;

for (const e of fs.readdirSync(CHANGES, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name === '_template') continue;
  slices++;
  const summary = path.join(CHANGES, e.name, 'summary.md');
  const text = fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '';
  const line = text.match(/^\|\s*调用技能\s*\|\s*(.+?)\s*\|$/m);
  if (!line) {
    const sliceRel = path.relative(ROOT, path.join(CHANGES, e.name)).split(path.sep).join('/');
    const since = firstAddDate(sliceRel) || firstAddDate(`${sliceRel}/summary.md`);
    if (since && since >= ENFORCE_SINCE) enforced.push(`${e.name}（${since} 入库）`);
    else noRecord.push(e.name);
    continue;
  }
  const parsed = parseSkillNames(line[1]);
  if (parsed.declaredNone) {
    recorded++;
    continue;
  }
  if (!parsed.names.length) {
    unknown.push(`${e.name}: 无法解析（${line[1]}）`);
    continue;
  }
  recorded++;
  for (const n of parsed.names) {
    counts.set(n, (counts.get(n) || 0) + 1);
    if (!known.has(n)) unknown.push(`${e.name}: ${n}`);
  }
}

const zero = [...known].filter((n) => !counts.has(n));
console.log(`切片=${slices} 有技能记录=${recorded} 无记录=${noRecord.length} 技能库=${known.size}（目录 ${dirs}）`);
console.log(`新切片强制留痕（>= ${ENFORCE_SINCE}）：缺行 ${enforced.length} 个${enforced.length ? '（' + enforced.join('、') + '）' : ''}`);
// 同名技能的计数会合并成一个名字：必须列出两处路径，否则数字看着正常实则串味
for (const [n, list] of dup) console.log(`⚠ 同名技能 ${n}：${list.join(' | ')}（计数按合并口径；引用时带族前缀）`);
if (counts.size) {
  console.log('\n调用次数：');
  for (const [n, c] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${n} ${c}`);
}
console.log(`\n零调用（仅按有记录切片计，历史无记录不计入）: ${zero.length} 个`);
if (zero.length) console.log(`  ${zero.slice(0, 10).join('、')}${zero.length > 10 ? ' …' : ''}`);

const errors = [
  ...enforced.map(
    (m) =>
      `❌ 新切片缺「调用技能」行：${m}\n✅ FIX: 在 summary.md 加一行「| 调用技能 | 技能名，无则写「无」 |」（${ENFORCE_SINCE} 起新增切片强制留痕）。`,
  ),
  ...unknown.map(
    (u) => `❌ 技能名未在技能库找到：${u}\n✅ FIX: 改用 .agents/skills 或 .harness/skills 下的真实目录名（剥 NN- 前缀）。`,
  ),
];
if (errors.length) {
  console.log('');
  for (const e of errors) console.log(e);
}
console.log(`\nERRORS: ${JSON.stringify(errors)}`);
process.exit(errors.length ? 1 : 0);
