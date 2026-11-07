#!/usr/bin/env node
/**
 * 技能可执行化审计（skill ↔ script linkage，PLAN-skill-usage v3 批 A）
 *
 * 动机：官方三层里 Level 3 的 scripts「代码永不进 context，只把输出进 context」是最高效的一层。
 *      tea 有 scripts/ 下几十个确定性脚本，但技能正文大多不指向它们 —— 本脚本把落差量出来。
 *
 * 度量（全部确定性，不调 LLM）：
 *   1. 每个技能引用了几条 scripts/xxx（refScripts）与几条命令行步骤（cmdSteps）
 *   2. 被引用的脚本是否真实存在，且 node --check 能解析（不执行，无副作用）
 *   3. 仓库 scripts/ 里有几个脚本从未被任何技能引用（孤儿脚本）
 *
 * 用法：node scripts/audit-skill-tooling.cjs [--write]
 *   --write 写 docs/skills/TOOLING.md
 * 退出码：0（审计脚本不阻断门禁；门禁在 verify-harness §4m / §4n）
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FAMILIES = ['main-dev', 'biz-dev', 'trouble-shooting', 'prompt-templates'];

function skillFiles() {
  const out = [];
  // 深度受限递归：.agents/skills/<name>/SKILL.md 两层，.harness/skills/<family>/<name>/SKILL.md 三层
  const collect = (dir, depth) => {
    if (!fs.existsSync(dir) || depth > 2) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const sub = path.join(dir, e.name);
      const sf = path.join(sub, 'SKILL.md');
      if (fs.existsSync(sf)) {
        const rel = path.relative(ROOT, sf).replace(/\\/g, '/');
        out.push({ name: e.name, rel, dir: sub, self: rel.startsWith('.harness/') });
      } else {
        collect(sub, depth + 1);
      }
    }
  };
  collect(path.join(ROOT, '.agents/skills'), 0);
  collect(path.join(ROOT, '.harness/skills'), 0);
  return out;
}

function scriptFiles() {
  const dir = path.join(ROOT, 'scripts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(cjs|js|mjs)$/.test(f))
    .map(f => {
      const abs = path.join(dir, f);
      // @oneshot：一次性诊断脚本，使命已完结，只留历史复现，不该再作为技能入口
      const head = fs.readFileSync(abs, 'utf8').slice(0, 1200);
      return { name: f, rel: `scripts/${f}`, abs, oneshot: /@oneshot/.test(head) };
    });
}

function bodyOf(rel) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return t.replace(/^---[\s\S]*?---/, '');
}

// 元数据触发词（只报不阻断）：description 没写「什么时候该用我」，模型只能靠名字猜
const TRIGGER_WORD = /当[^。]{0,60}?(?:时用|时)|触发[:：]|Use when|use when|when to use|Triggers on/;
function descOf(rel) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = t.match(/^description:\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

// F10 跨技能裸引用（只报不阻断）：正文里反引号包裹的 kebab-case 若不在技能库，
// 且该行含「技能 / skill / 路由 / →」线索，就是指向了不存在的技能。
// §4m 只查路径与命令锚点，查不到这类。
const SKILL_REF = /`([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g;
const SKILL_CTX = /技能|skill|路由|→/;
// 同形但确定不是技能名的：npm 包、CSS 类、ARIA / Vue 指令
const NOT_SKILL = /^(lucide-|date-fns|vue-|@vue|react|axios|pinia|idb-|jwt-|focus-trap|change-case|async-validator|rollup-|tailwind|aria-|data-|v-|bg-|text-|size-|z-)/;
function skillRefMisses(rel, names) {
  const body = bodyOf(rel);
  const out = [];
  for (const ln of body.split('\n')) {
    if (!SKILL_CTX.test(ln)) continue;
    for (const m of ln.matchAll(SKILL_REF)) {
      const t = m[1];
      if (names.has(t) || NOT_SKILL.test(t)) continue;
      // biz-dev 等族内互引用常剥掉 NN- 前缀
      if ([...names].some((n) => n.endsWith('-' + t))) continue;
      out.push(t);
    }
  }
  return [...new Set(out)];
}

// 引用到的脚本文件名（不含 lib/ 与 node_modules）
const SCRIPT_REF = /scripts\/([\w.-]+\.(?:cjs|mjs|js))/g;
// 只认真正的命令行工具。此前把「运行 / 执行 / 跑」这类中文动词也算命令步骤，
// 导致「半可执行」虚高——正文写「跑测试」不等于有可执行入口。
const CMD_STEP = /^\s*(?:\d+\.|[-*])\s+.*(?:\bnode\b|\bnpm\b|\bnpx\b|\bgit\b|\bpython\b|\bmvn\b|\bvitest\b|\bpytest\b|\bcurl\b|\bdocker\b)/gm;

const skills = skillFiles().map(s => {
  const body = bodyOf(s.rel);
  const refs = [...new Set([...body.matchAll(SCRIPT_REF)].map(m => m[1]))];
  const cmds = (body.match(CMD_STEP) || []).length;
  const idx = refs.length * 2 + Math.min(cmds, 3);
  const tier = refs.length > 0 ? '可执行' : (cmds >= 2 ? '半可执行' : '纯文档');
  const desc = descOf(s.rel);
  return { ...s, refs, cmds, idx, tier, desc, trigger: TRIGGER_WORD.test(desc) };
});

const scripts = scriptFiles();
const parsed = new Map();
for (const sc of scripts) {
  try {
    execFileSync(process.execPath, ['--check', sc.abs], { stdio: 'ignore' });
    parsed.set(sc.name, true);
  } catch { parsed.set(sc.name, false); }
}

// 被引用但不存在 / 解析失败
const missingRefs = [];
for (const s of skills) {
  for (const r of s.refs) {
    const file = scripts.find(x => x.name === r);
    if (!file) missingRefs.push({ skill: s.name, ref: r, why: '脚本文件不存在' });
    else if (parsed.get(r) === false) missingRefs.push({ skill: s.name, ref: r, why: 'node --check 解析失败' });
  }
}

// 孤儿脚本：从未被任何技能正文引用
const cited = new Set(skills.flatMap(s => s.refs));
const orphans = scripts.filter(sc => !cited.has(sc.name)).map(sc => sc.name);

// 调用方分层：把「技能没点名、但门禁/CI 在跑」的脚本与「谁都不引用」的真孤儿分开。
// 前者是技能侧的可执行化缺口（该在正文点名），后者才该判「接给谁 / 删」——
// 混在一起会让「47 个孤儿」看起来像 47 个废弃脚本，实际大半是日均在 CI 里跑的审计器。
function externalCalls() {
  const chunks = [];
  const wf = path.join(ROOT, '.github', 'workflows');
  if (fs.existsSync(wf)) {
    for (const f of fs.readdirSync(wf)) {
      if (/\.yml$/.test(f)) chunks.push(fs.readFileSync(path.join(wf, f), 'utf8'));
    }
  }
  const pkgPath = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      chunks.push(Object.values(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts || {}).join('\n'));
    } catch { /* package.json 不可解析时只算 CI */ }
  }
  const hit = new Set();
  for (const m of chunks.join('\n').matchAll(SCRIPT_REF)) hit.add(m[1]);
  // 脚本间 require 也是真实调用方：只认「scripts/xxx」文本会把
  // 被 audit-skill-usage.cjs require 的 skill-usage-parse.cjs 误判成孤儿
  const dir = path.join(ROOT, 'scripts');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => /\.(cjs|js|mjs)$/.test(x))) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of t.matchAll(/require\(\s*['"]\.\/([\w.-]+\.(?:cjs|mjs|js))['"]\s*\)/g)) hit.add(m[1]);
      for (const m of t.matchAll(/from\s+['"]\.\/([\w.-]+\.(?:cjs|mjs|js))['"]/g)) hit.add(m[1]);
    }
  }
  return hit;
}
const gateCited = externalCalls();
const isOneshot = (n) => !!(scripts.find((s) => s.name === n) || {}).oneshot;
const gateOnly = orphans.filter(o => gateCited.has(o));
const oneshotOnly = orphans.filter(o => !gateCited.has(o) && isOneshot(o));
const trueOrphans = orphans.filter(o => !gateCited.has(o) && !isOneshot(o));

const byTier = { '可执行': [], '半可执行': [], '纯文档': [] };
for (const s of skills) byTier[s.tier].push(s);

// F10：跨技能裸引用死链（只报不阻断）
const nameSet = new Set(skills.map((s) => s.name));
for (const s of skills) s.refMiss = skillRefMisses(s.rel, nameSet);
const refMisses = skills.filter((s) => s.refMiss.length > 0);

const lines = [];
lines.push('# 技能可执行化审计（自动生成，勿手改）');
lines.push('');
lines.push(`> 生成：node scripts/audit-skill-tooling.cjs --write`);
lines.push(`> 技能 ${skills.length} 个（自写 ${skills.filter(s => s.self).length} / 导入 ${skills.filter(s => !s.self).length}）；脚本 ${scripts.length} 个；解析失败 ${[...parsed.values()].filter(v => v === false).length} 个`);
lines.push('');
lines.push('## 汇总');
lines.push('');
lines.push('| 档位 | 数量 | 判定 |');
lines.push('|---|---|---|');
lines.push(`| 可执行（引用 ≥1 个 scripts/） | ${byTier['可执行'].length} | 有一个确定性入口 |`);
lines.push(`| 半可执行（≥2 条命令行步骤） | ${byTier['半可执行'].length} | 有命令但未沉淀成脚本 |`);
lines.push(`| 纯文档 | ${byTier['纯文档'].length} | 全靠模型现场推导 |`);
lines.push('');
lines.push(`孤儿脚本（零技能引用）：**${orphans.length} / ${scripts.length}**——${gateOnly.length} 个在 CI/门禁或脚本间被调用（缺口在技能正文没点名），${oneshotOnly.length} 个 @oneshot 一次性诊断（使命已完结），${trueOrphans.length} 个谁都不引用（该判「接给谁 / 删」）`);
lines.push('');
lines.push('## 跨技能引用（只报不阻断）');
lines.push('');
if (refMisses.length === 0) {
  lines.push('无：正文里反引号包裹的技能名都能在库中找到。');
} else {
  lines.push(`| 技能 | 指向不存在的技能名 |`);
  lines.push('|---|---|');
  for (const s of refMisses) lines.push(`| ${s.name} | ${s.refMiss.join('、')} |`);
  lines.push('');
  lines.push('判定：反引号 + kebab-case + 该行含「技能 / skill / 路由 / →」。§4m 只查路径与命令锚点，这类裸技能名不在其范围。');
}
lines.push('');
lines.push('## 元数据触发词（只报不阻断）');
lines.push('');
const selfSkills = skills.filter((s) => s.self);
const importSkills = skills.filter((s) => !s.self);
const selfMiss = selfSkills.filter((s) => !s.trigger);
const importMiss = importSkills.filter((s) => !s.trigger);
lines.push('| 层 | 有「当…时用 / Use when」 | 缺 |');
lines.push('|---|---|---|');
lines.push(`| 自写层（.harness） | ${selfSkills.length - selfMiss.length} / ${selfSkills.length} | ${selfMiss.length} |`);
lines.push(`| 导入层（.agents） | ${importSkills.length - importMiss.length} / ${importSkills.length} | ${importMiss.length} |`);
lines.push('');
if (selfMiss.length) {
  lines.push(`自写层缺触发词：${selfMiss.map((s) => '`' + s.name + '`').join('、')}`);
  lines.push('');
}
lines.push('导入层属上游包原样，只登记不逐条改（改了下次同步就丢）；自写层缺项应补「当…时用」。');
lines.push('');
lines.push('## 可执行技能（已接上脚本层）');
lines.push('');
lines.push('| 技能 | 来源 | 引用脚本 | 命令步骤 |');
lines.push('|---|---|---|---|');
for (const s of byTier['可执行']) {
  lines.push(`| ${s.name} | ${s.self ? '自写' : '导入'} | ${s.refs.join('、')} | ${s.cmds} |`);
}
lines.push('');
lines.push('## 半可执行（有命令、未沉淀）');
lines.push('');
lines.push('| 技能 | 来源 | 命令步骤 |');
lines.push('|---|---|---|');
for (const s of byTier['半可执行']) lines.push(`| ${s.name} | ${s.self ? '自写' : '导入'} | ${s.cmds} |`);
lines.push('');
lines.push('## 纯文档（零确定性入口）');
lines.push('');
lines.push(byTier['纯文档'].map(s => s.name + (s.self ? '(自写)' : '')).join('、') || '（无）');
lines.push('');
lines.push('## 引用异常');
lines.push('');
if (missingRefs.length === 0) lines.push('无：正文引用的每个脚本都存在且可解析。');
else for (const m of missingRefs) lines.push(`- ${m.skill} → \`${m.ref}\`：${m.why}`);
lines.push('');
lines.push('## 孤儿脚本：门禁/CI 在调用、但技能正文未点名（缺口在技能侧）');
lines.push('');
lines.push(gateOnly.length ? gateOnly.map(o => '`' + o + '`').join('、') : '（无）');
lines.push('');
lines.push('## 一次性诊断（@oneshot，不接技能入口）');
lines.push('');
lines.push(oneshotOnly.length ? oneshotOnly.map(o => '`' + o + '`').join('、') : '（无）');
lines.push('');
lines.push('## 真孤儿脚本：谁都不引用（逐个判「接给谁 / 删」）');
lines.push('');
lines.push(trueOrphans.length ? trueOrphans.map(o => '`' + o + '`').join('、') : '（无）');
lines.push('');

const out = lines.join('\n');
console.log(out);

if (process.argv.includes('--write')) {
  // 放 docs/reference/ 而非 docs/skills/：后者是「人读审查页」，新增一页必须同步 AGENTS.md §12 声明（常驻层无余量）
  const rel = 'docs/reference/skill-tooling-audit.md';
  const meta = `---\nlast_updated: ${new Date().toISOString().slice(0, 10)}\nstatus: active\nowner: ai\n---\n\n`;
  fs.mkdirSync(path.join(ROOT, 'docs/reference'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), meta + out, 'utf8');
  console.log(`\n已写入 ${rel}`);
}
