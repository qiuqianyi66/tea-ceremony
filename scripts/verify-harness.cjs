#!/usr/bin/env node
/**
 * Harness 一致性体检（doc-gardening，Harness 285「熵管理」落地 / PLAN P1-R4）。
 *
 * 检查 AGENTS.md 声明的治理数字 vs 仓库实际，漂移即报错：
 *   ADR 编号连续性 + 声明值 / CI job 数 / 技能数（.agents 66、.harness 43 四族）
 *   各族 README 声明数 + .agents 路由表双向核对（README 不列 = 不存在）
 *   关键路径引用（docs/ .harness/ .agents/ scripts/ src/ backend/）存在性
 *   wiki 四件套 / changes 三件套+review 门禁 / docs/skills 审查页 / .claude agents
 *   docs 元信息头（缺失 + status 值域）/ AGENTS.md 行数（维护规则 200-350）
 *   技能入口盘点（仓库态）：git 跟踪的 SKILL.md 必须落在已知技能根内（4j）
 *
 * 用法：node scripts/verify-harness.cjs   期望输出 ERRORS: []
 * 有错误 exit 1（可挂 CI），无错误 exit 0。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { collect } = require('./lib/fs-utils.cjs');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; }
}

function countSkillDirs(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md'))).length;
}

const agents = read('AGENTS.md');
if (!agents) { errors.push('AGENTS.md 不存在'); process.exit(1); }

// 1. AGENTS.md 行数（维护规则 200-350）
const agentsLines = agents.split(/\r?\n/).length;
if (agentsLines > 350) errors.push(`AGENTS.md ${agentsLines} 行，超出维护上限 350（维护规则 200-350）`);
else if (agentsLines < 200) warnings.push(`AGENTS.md ${agentsLines} 行，低于维护下限 200（可选精简）`);

// 2. ADR 编号一致性
const adrDir = path.join(ROOT, 'docs/ADR');
const adrNums = fs.existsSync(adrDir)
  ? fs.readdirSync(adrDir).filter(f => /^ADR-\d+\.md$/.test(f))
      .map(f => parseInt(f.match(/^ADR-(\d+)\.md$/)[1], 10)).sort((a, b) => a - b)
  : [];
if (adrNums.length === 0) {
  errors.push('docs/ADR/ 为空或不存在');
} else {
  let prev = adrNums[0];
  for (const n of adrNums.slice(1)) {
    if (n !== prev + 1) errors.push(`ADR 编号不连续：ADR-${String(prev).padStart(3, '0')} 之后是 ADR-${String(n).padStart(3, '0')}（docs/ADR/）`);
    prev = n;
  }
  const claim = agents.match(/ADR-00\d~0?(\d+)/);
  if (claim) {
    const claimedMax = parseInt(claim[1], 10);
    const actualMax = adrNums[adrNums.length - 1];
    if (claimedMax !== actualMax) {
      errors.push(`AGENTS.md 声明 ADR 至 ADR-${String(claimedMax).padStart(3, '0')}，docs/ADR 实际至 ADR-${String(actualMax).padStart(3, '0')}`);
    }
  }
}

// 2b. .harness/rules/工程结构.md 的 ADR 声明 vs 实际
const structureRules = read('.harness/rules/工程结构.md');
if (structureRules) {
  const sClaim = structureRules.match(/ADR-00\d~0?(\d+)/);
  if (sClaim) {
    const claimedMax = parseInt(sClaim[1], 10);
    const actualMax = adrNums.length > 0 ? adrNums[adrNums.length - 1] : 0;
    if (claimedMax !== actualMax) {
      errors.push(`.harness/rules/工程结构.md 声明 ADR 至 ADR-${String(claimedMax).padStart(3, '0')}，docs/ADR 实际至 ADR-${String(actualMax).padStart(3, '0')}`);
    }
  }
}

// 3. CI job 数（只统计 jobs: 块内的两空格缩进 job 名，排除 on: 下的 push/pull_request）
const ci = read('.github/workflows/ci.yml');
let ciJobs = 0;
let ciJobsList = [];
let ciClaim = null;
if (!ci) {
  errors.push('.github/workflows/ci.yml 不存在');
} else {
  const jobsIdx = ci.search(/^jobs:$/m);
  const jobsBody = jobsIdx >= 0 ? ci.slice(jobsIdx) : ci;
  ciJobs = (jobsBody.match(/^  [a-z][a-z0-9-]*:$/gm) || []).length;
  ciJobsList = (jobsBody.match(/^  [a-z][a-z0-9-]*:$/gm) || []).map(s => s.replace(/^  /, '').replace(/:$/, ''));
  ciClaim = agents.match(/CI (\d+) job/);
  if (ciClaim && ciJobs !== parseInt(ciClaim[1], 10)) {
    errors.push(`AGENTS.md 声明 CI ${ciClaim[1]} job，ci.yml 实际 ${ciJobs} job`);
  }
}

// 4. 技能数量一致性
const agentsSkillDirs = countSkillDirs(path.join(ROOT, '.agents/skills'));
const skillsClaim = agents.match(/技能路由总表（(\d+) 个）/);
if (skillsClaim && agentsSkillDirs !== parseInt(skillsClaim[1], 10)) {
  errors.push(`AGENTS.md 声明 .agents/skills 技能 ${skillsClaim[1]} 个，实际 ${agentsSkillDirs} 个`);
}

const families = ['main-dev', 'biz-dev', 'trouble-shooting', 'prompt-templates'];
const famCounts = {};
for (const fam of families) famCounts[fam] = countSkillDirs(path.join(ROOT, `.harness/skills/${fam}`));
const harnessTotal = families.reduce((s, f) => s + famCounts[f], 0);
const harnessClaim = agents.match(/技能全套 (\d+) 个（main-dev (\d+) \/ biz-dev (\d+) \/ trouble-shooting (\d+)）/);
if (harnessClaim) {
  const [, total, md, bd, ts] = harnessClaim.map(Number);
  if (harnessTotal !== total) errors.push(`AGENTS.md 声明 .harness/skills 技能全套 ${total} 个，实际 ${harnessTotal} 个`);
  if (famCounts['main-dev'] !== md) errors.push(`AGENTS.md 声明 main-dev ${md} 个，实际 ${famCounts['main-dev']} 个`);
  if (famCounts['biz-dev'] !== bd) errors.push(`AGENTS.md 声明 biz-dev ${bd} 个，实际 ${famCounts['biz-dev']} 个`);
  if (famCounts['trouble-shooting'] !== ts) errors.push(`AGENTS.md 声明 trouble-shooting ${ts} 个，实际 ${famCounts['trouble-shooting']} 个`);
} else {
  warnings.push('AGENTS.md 未找到 .harness/skills 数量声明（技能全套 N 个）');
}

// 4b. .agents/skills/README.md 声明的流程族数 vs 实际
const agentsSkillsReadme = read('.agents/skills/README.md');
if (agentsSkillsReadme) {
  const famClaim = agentsSkillsReadme.match(/流程族（main-dev \/ biz-dev \/ trouble-shooting，(\d+) 个）/);
  if (famClaim && parseInt(famClaim[1], 10) !== harnessTotal) {
    errors.push(`.agents/skills/README.md 声明流程族 ${famClaim[1]} 个，.harness/skills 实际 ${harnessTotal} 个`);
  }
  const titleClaim = agentsSkillsReadme.match(/路由总表（(\d+) 个）/);
  if (titleClaim && parseInt(titleClaim[1], 10) !== agentsSkillDirs) {
    errors.push(`.agents/skills/README.md 标题声明技能 ${titleClaim[1]} 个，实际 ${agentsSkillDirs} 个`);
  }
}

// 4c. .harness/rules/技能规范.md 的流程族声明 vs 实际（防止 30→32 类旧数字残留）
const skillRules = read('.harness/rules/技能规范.md');
if (skillRules) {
  const famClaim = skillRules.match(/流程族（main-dev (\d+) \/ biz-dev (\d+) \/ trouble-shooting (\d+)）/);
  if (famClaim) {
    const [, mdClaim, bdClaim, tsClaim] = famClaim.map(Number);
    if (famCounts['main-dev'] !== mdClaim) errors.push(`.harness/rules/技能规范.md 声明 main-dev ${mdClaim} 个，实际 ${famCounts['main-dev']} 个`);
    if (famCounts['biz-dev'] !== bdClaim) errors.push(`.harness/rules/技能规范.md 声明 biz-dev ${bdClaim} 个，实际 ${famCounts['biz-dev']} 个`);
    if (famCounts['trouble-shooting'] !== tsClaim) errors.push(`.harness/rules/技能规范.md 声明 trouble-shooting ${tsClaim} 个，实际 ${famCounts['trouble-shooting']} 个`);
  }
}

// 4d. .agents/skills/README.md 路由表双向核对（技能规范.md：README 不列 = 不存在）
const agentsReadmeText = read('.agents/skills/README.md');
if (agentsReadmeText) {
  const listed = new Set();
  for (const m of agentsReadmeText.matchAll(/\[[^\]]+\]\(([^)]+?\/SKILL\.md)\)/g)) {
    const p = m[1].replace(/\\/g, '/');
    listed.add(p.split('/')[0]);
    if (!fs.existsSync(path.join(ROOT, '.agents/skills', p))) {
      errors.push(`.agents/skills/README.md 路由表链接不存在：${p}`);
    }
  }
  const agentsActual = fs.existsSync(path.join(ROOT, '.agents/skills'))
    ? fs.readdirSync(path.join(ROOT, '.agents/skills'), { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, '.agents/skills', d.name, 'SKILL.md')))
        .map(d => d.name)
    : [];
  for (const d of agentsActual) {
    if (!listed.has(d)) errors.push(`.agents/skills/${d}/SKILL.md 未列入路由表 README（技能规范：README 不列 = 不存在）`);
  }
}

// 4e. .harness/skills 各族 README 技能数声明 vs 实际（main-dev / biz-dev / trouble-shooting）
for (const fam of families) {
  const famReadme = read(`.harness/skills/${fam}/README.md`);
  if (!famReadme) {
    errors.push(`.harness/skills/${fam}/README.md 缺失（各族路由表）`);
    continue;
  }
  const m = famReadme.match(new RegExp('(' + fam + ').*?(\\d+) 个[)）]'));
  if (!m) {
    warnings.push(`.harness/skills/${fam}/README.md 未找到“${fam} N 个”声明`);
    continue;
  }
  const claimed = parseInt(m[2], 10);
  if (claimed !== famCounts[fam]) {
    errors.push(`.harness/skills/${fam}/README.md 声明 ${claimed} 个，实际 ${famCounts[fam]} 个`);
  }
}

// 4f. 技能 frontmatter type/verification 标注（O-11，K7 技能准入）
//    type 值域三值；type: executable 必填 verification；声明 verification 必须 type: executable
const VALID_TYPES = new Set(['executable', 'knowledge', 'flow']);
const SKILL_ROOTS = [
  path.join(ROOT, '.agents/skills'),
  ...families.map(f => path.join(ROOT, `.harness/skills/${f}`)),
];
function collectSkillFrontmatters() {
  const out = [];
  for (const dir of SKILL_ROOTS) {
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const sf = path.join(dir, e.name, 'SKILL.md');
      if (fs.existsSync(sf)) {
        const text = fs.readFileSync(sf, 'utf8');
        const front = (text.match(/^---[\s\S]*?---/) || [''])[0];
        out.push({ rel: path.relative(ROOT, sf).replace(/\\/g, '/'), front });
      }
    }
  }
  return out;
}
function fmField(front, name) {
  const m = front.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1] : null;
}
// 4f-2. verification 里点名的目录/文件/run 目标必须真实存在。
//   只判「指向是否存在」，不解释命令语义（工具级命令如 alembic/mvn 不校验）。
//   动机：`type: executable` 只要填了字符串就绿，写一条指向不存在脚本的命令同样绿 = 装饰字段。
const PKG_SCRIPTS = new Set(Object.keys(require(path.join(ROOT, 'package.json')).scripts || {}));
function verificationMisses(cmd) {
  const misses = [];
  let base = ROOT;
  for (const seg of cmd.split('&&')) {
    const tokens = seg.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    if (tokens[0] === 'cd') {
      const dir = tokens[1];
      if (!dir || /</.test(dir)) continue;
      const abs = path.resolve(base, dir);
      if (fs.existsSync(abs)) base = abs;
      else misses.push(`cd ${dir}`);
      continue;
    }
    if (/^(npm|pnpm|yarn)$/.test(tokens[0])) {
      const i = tokens.indexOf('run');
      const name = i > 0 ? tokens[i + 1] : undefined;
      if (name && !/</.test(name) && !PKG_SCRIPTS.has(name)) misses.push(`${tokens[0]} run ${name}`);
      continue;
    }
    for (const t of tokens.slice(1)) {
      if (t.startsWith('-') || /</.test(t)) continue;
      if (!(/\.(cjs|mjs|js|ts|py|sql|json)$/.test(t) || t.includes('/'))) continue;
      if (!fs.existsSync(path.resolve(base, t))) misses.push(t);
    }
  }
  return misses;
}
for (const s of collectSkillFrontmatters()) {
  const type = fmField(s.front, 'type');
  const verification = fmField(s.front, 'verification');
  if (type && !VALID_TYPES.has(type)) {
    errors.push(`❌ ${s.rel} type 值域非法：${type}。\n✅ FIX: 改为 executable|knowledge|flow 之一。\n📖 See: .harness/rules/技能规范.md §2（O-11）`);
  }
  if (type === 'executable' && !verification) {
    errors.push(`❌ ${s.rel} type: executable 缺 verification 验证命令。\n✅ FIX: 补 frontmatter verification 字段（可运行命令）。\n📖 See: .harness/rules/技能规范.md §2（O-11）`);
  }
  if (verification && type !== 'executable') {
    errors.push(`❌ ${s.rel} 声明 verification 但 type=${type || '（缺省）'}。\n✅ FIX: type 改为 executable。\n📖 See: .harness/rules/技能规范.md §2（O-11）`);
  }
  if (type === 'executable' && verification) {
    const misses = verificationMisses(verification);
    if (misses.length) {
      errors.push(`❌ ${s.rel} verification 指向不存在的目标：${misses.join('、')}。\n✅ FIX: 改正路径，或删除该 verification。\n📖 See: .harness/rules/技能规范.md §2（O-11）`);
    }
  }
}

// 4g. 技能 frontmatter name/description 与 name=目录（技能规范 §1/§2，原 PowerShell 人工段的机械化替代）
for (const s of collectSkillFrontmatters()) {
  const name = fmField(s.front, 'name');
  const desc = fmField(s.front, 'description');
  const dir = path.basename(path.dirname(path.join(ROOT, s.rel))).replace(/^\d{2}-/, '');
  if (!name) {
    errors.push(`❌ ${s.rel} frontmatter 缺 name。\n✅ FIX: 补 name（= 目录名，kebab-case）。\n📖 See: .harness/rules/技能规范.md §2`);
  } else if (name !== dir) {
    errors.push(`❌ ${s.rel} name≠目录名：${name} vs ${dir}。\n✅ FIX: 二者取一致（name 用纯 kebab-case，目录带 NN- 前缀时剥前缀比对）。\n📖 See: .harness/rules/技能规范.md §1`);
  }
  if (!desc) {
    errors.push(`❌ ${s.rel} frontmatter 缺 description。\n✅ FIX: 补触发式描述（见 §3）。\n📖 See: .harness/rules/技能规范.md §2`);
  }
}

// 4i. 技能 last-reviewed 审核日期（O-12，白皮书 O.1 元数据扩展融入；防静默失效）
//    type: executable 必填 last-reviewed: YYYY-MM-DD；缺/格式非法/未来日期 = error；超 180 天 = warning
const DAY_MS = 24 * 60 * 60 * 1000;
for (const s of collectSkillFrontmatters()) {
  const type = fmField(s.front, 'type');
  if (type !== 'executable') continue;
  const lr = fmField(s.front, 'last-reviewed');
  if (!lr) {
    errors.push(`❌ ${s.rel} type: executable 缺 last-reviewed 审核日期。\n✅ FIX: 补 frontmatter last-reviewed: YYYY-MM-DD（最近人工审核日期）。\n📖 See: .harness/rules/技能规范.md §2（O-12）`);
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lr)) {
    errors.push(`❌ ${s.rel} last-reviewed 格式非法：${lr}。\n✅ FIX: 改为 YYYY-MM-DD。\n📖 See: .harness/rules/技能规范.md §2（O-12）`);
    continue;
  }
  const d = new Date(lr + 'T00:00:00');
  if (isNaN(d.getTime()) || d > new Date()) {
    errors.push(`❌ ${s.rel} last-reviewed 非有效日期或为未来：${lr}。\n✅ FIX: 填真实人工审核日期。\n📖 See: .harness/rules/技能规范.md §2（O-12）`);
    continue;
  }
  const ageDays = Math.floor((Date.now() - d.getTime()) / DAY_MS);
  if (ageDays > 180) {
    warnings.push(`${s.rel} last-reviewed 距今 ${ageDays} 天未人工审核（>180 天，防静默失效：规则漂移/技能断链当场不报错、几周后才显形）——请人工复核正文与引用后更新日期`);
  }
}

// 4h. 死技能审计：从未被任何路由表引用的技能（技能规范：README 不列 = 不存在；
//     原仅做数量对账，新增目录但没人登记路由表时不会报错——此段机械化兜底）
{
  const routingText = [
    '.agents/skills/README.md',
    ...families.map(f => `.harness/skills/${f}/README.md`),
  ].map(p => read(p)).filter(Boolean).join('\n');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const orphans = [];
  for (const dir of SKILL_ROOTS) {
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || !fs.existsSync(path.join(dir, e.name, 'SKILL.md'))) continue;
      const bare = e.name.replace(/^\d{2}-/, '');
      if (!new RegExp(`\\b${esc(bare)}\\b`).test(routingText)) {
        orphans.push(`${path.relative(ROOT, dir).replace(/\\/g, '/')}/${bare}`);
      }
    }
  }
  if (orphans.length > 0) {
    errors.push(`未被任何路由表引用的技能 ${orphans.length} 个：${orphans.join(', ')}（死技能审计：补路由表登记，或删除目录）`);
  }
}

// 4j. 技能入口盘点（仓库态）：git 跟踪的 SKILL.md 必须落在已知技能根内
//    数量对账只覆盖已登记的两个根，新增入口目录（如 .claude/skills/）会静默漏检且不报错。
//    本机未跟踪入口（.codex/skills/、claude-code-template/）属环境态：不进 CI、不参与治理、不计入数量。
{
  let tracked = null;
  try {
    tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
      .filter(p => p === 'SKILL.md' || p.endsWith('/SKILL.md'));
  } catch {
    warnings.push('git 不可用，跳过技能入口盘点（4j）');
  }
  if (tracked) {
    const knownRoot = p =>
      /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(p) ||
      new RegExp(`^\\.harness/skills/(${families.join('|')})/[^/]+/SKILL\\.md$`).test(p);
    for (const p of tracked) {
      if (!knownRoot(p)) {
        errors.push(`git 跟踪的技能不在已知技能根内：${p}\n✅ FIX: 迁入 .agents/skills/<name>/ 或 .harness/skills/<family>/<NN-name>/；新增入口目录须同步 SKILL_ROOTS 与路由表。\n📖 See: .harness/rules/技能规范.md §1（治理边界）`);
      }
    }
  }
}

// 4k. 自写流程技能必须带自检段
//    只有「触发 → 工作流」没有「做完怎么验」，等于有开头没有验收；实测 biz-dev 22 行技能
//    四段齐全后密度够用，缺的只是这一处（12-growth-notification 占位未写自检）。
//    只约束 .harness/skills（自写流程族）；.agents/skills 多为导入包（参考手册型），不要求。
{
  for (const family of families) {
    const dir = path.join(ROOT, '.harness/skills', family);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const rel = `.harness/skills/${family}/${name}/SKILL.md`;
      if (!fs.existsSync(path.join(dir, name, 'SKILL.md'))) continue;
      const text = read(rel);
      if (text === null) continue;
      if (!/^## .*(自检|检查清单)/m.test(text) && !/- \[ \]/.test(text)) {
        errors.push(`${rel} 缺少自检段\n✅ FIX: 补 3-5 条可判真假的勾选项（写「做了什么」不写「注意质量」）。\n📖 See: .harness/rules/技能规范.md §2（技能模板）`);
      }
    }
  }
}

// 4l. 有资产目录却没在正文指路 = 第三级渐进加载断裂
//    references/assets/scripts 只有被正文点名才会被读；正文不写路径，等于资产不存在。
//    .harness 自写技能记 error（能改）；.agents 多为导入包，记 warning（不改原件，只提示）。
{
  const check = (base, isHarness) => {
    if (!fs.existsSync(base)) return;
    const push = msg => (isHarness ? errors : warnings).push(msg);
    for (const name of fs.readdirSync(base)) {
      const dir = path.join(base, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const rel = `${base}/${name}/SKILL.md`;
      const text = read(rel);
      if (text === null) continue;
      for (const sub of ['references', 'assets', 'scripts']) {
        if (!fs.existsSync(path.join(dir, sub))) continue;
        if (text.includes(sub + '/')) continue;
        push(`${rel} 有 ${sub}/ 目录但正文从未提到 ${sub}/，第三级加载会断\n✅ FIX: 正文加一句「需要 X 时读 ${sub}/<文件名>」并按实际文件名列出。\n📖 See: .agents/skills/README.md §加载方式（三级）`);
      }
    }
  };
  check('.agents/skills', false);
  for (const f of families) check(`.harness/skills/${f}`, true);
}

// 4m. 自写技能正文反引号锚点存活（PLAN-skill-usage v3）
//   只查 .harness 自写技能：导入包引用的是上游仓库路径，与本仓不同源，检查只会产生假阳性。
//   排除模板占位（YYYY / { } / <slot> / :id）、通配与省略号、路由片段（/brew），
//   只判以 docs|scripts|src|backend|.harness|.agents 等已知根开头的路径。
const ANCHOR_ROOT = /^(?:docs|scripts|src|backend|frontend|tests|\.harness|\.agents|\.claude|\.github|AGENTS\.md|CLAUDE\.md|package\.json)/;
const ANCHOR_TEMPLATE = /[*…]|YYYY|\{|\}|:id|<\w+>/;
function anchorMisses(rel) {
  const abs = path.join(ROOT, rel);
  const body = fs.readFileSync(abs, 'utf8').replace(/^---[\s\S]*?---/, '');
  const misses = [];
  for (const m of body.matchAll(/`([^`\n]{2,160})`/g)) {
    const raw = m[1].trim();
    if (ANCHOR_TEMPLATE.test(raw)) continue;
    if (!ANCHOR_ROOT.test(raw)) continue;
    const token = raw.split(/[\s,，。;；]+/)[0].replace(/["'）)]*$/, '');
    if (!ANCHOR_ROOT.test(token)) continue;
    const cands = [path.join(ROOT, token), path.resolve(path.dirname(abs), token)];
    if (!cands.some(c => fs.existsSync(c))) misses.push(token);
  }
  return misses;
}
for (const s of collectSkillFrontmatters()) {
  if (!s.rel.startsWith('.harness/skills/')) continue;
  const misses = anchorMisses(s.rel);
  if (misses.length) {
    errors.push(`${s.rel} 有 ${misses.length} 处反引号路径不存在：${misses.slice(0, 3).join('、')}${misses.length > 3 ? ' …' : ''}。\n✅ FIX: 路径已迁走就更新为现路径；只是示例就去掉反引号或改成含 YYYY / {} 的模板占位。\n📖 See: .harness/rules/技能规范.md §2`);
  }
}

// 4n. 技能必须在所属路由表登记（AGENTS.md 铁律：README 不列 = 技能不存在）
//    与 4j 互补：4j 管「入口目录合法」，4n 管「有没有被路由表登记」。
//    新增技能忘写 README，模型按路由表找技能时就永远找不到它。
{
  const readmeCache = new Map();
  const textOf = (rel) => {
    if (!readmeCache.has(rel)) {
      let t = '';
      try { t = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { t = ''; }
      readmeCache.set(rel, t);
    }
    return readmeCache.get(rel);
  };
  for (const s of collectSkillFrontmatters()) {
    const parts = s.rel.split('/');
    let readme;
    if (/^\.agents\/skills\//.test(s.rel)) readme = '.agents/skills/README.md';
    else if (/^\.harness\/skills\//.test(s.rel)) readme = `.harness/skills/${parts[2]}/README.md`;
    else continue;
    const name = parts[parts.length - 2];
    if (!textOf(readme).includes(name)) {
      errors.push(`${s.rel} 未在路由表登记：${readme} 里找不到「${name}」。\n✅ FIX: 在该 README 增加技能名与触发场景。\n📖 See: .harness/rules/技能规范.md §5（增删改流程）`);
    }
  }
}

// 5. 关键路径引用存在性（AGENTS.md 中 docs/ .harness/ .agents/ scripts/ src/ backend/ 开头的反引号路径）
const seen = new Set();
const pathRefs = agents.match(/`((?:docs|\.harness|\.agents|scripts|src|backend)\/[^`]+)`/g) || [];
for (const raw of pathRefs) {
  const p = raw.slice(1, -1);
  if (seen.has(p) || /\s/.test(p) || p.includes('*')) continue;   // 带空格/通配符的是命令或 glob，跳过
  seen.add(p);
  if (!fs.existsSync(path.join(ROOT, p))) errors.push(`AGENTS.md 引用路径不存在：${p}`);
}

// 5b. SKILL.md 内部相对引用存在性（官方清单「Referenced files actually exist」）
//   只查 markdown 链接指向的本地相对路径；外部 URL 与锚点跳过。
//   动机：技能可以只带一个 SKILL.md 而正文照抄上游的 references/ 链接，链接全断但正文看着完好。
function skillLinkMisses(relPath) {
  const abs = path.join(ROOT, relPath);
  const misses = [];
  for (const m of fs.readFileSync(abs, 'utf8').matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const target = m[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(abs), target))) misses.push(target);
  }
  return misses;
}
for (const s of collectSkillFrontmatters()) {
  const misses = skillLinkMisses(s.rel);
  if (misses.length) {
    errors.push(`❌ ${s.rel} 有 ${misses.length} 处引用不存在：${misses.slice(0, 3).join('、')}${misses.length > 3 ? ' …' : ''}。\n✅ FIX: 恢复被引文件，或把链接降级为纯文本（保留 label）。\n📖 See: .harness/rules/技能规范.md §2`);
  }
}

// 6. 285 docs 分层惯例：plans/ 与 reference/ 目录存在（工程结构.md §六）
for (const sub of ['docs/plans', 'docs/reference']) {
  if (!fs.existsSync(path.join(ROOT, sub))) {
    errors.push(`docs 分层缺失：${sub}/（285 结构化知识库模板，见工程结构.md §六）`);
  }
}

// 7. docs/ 元信息头覆盖率（doc-gardening 扫描依据；warning 不阻断，缺头文件始终列出）
const allDocs = collect(path.join(ROOT, 'docs'), { exts: ['.md'] });
const noMetaFiles = allDocs.filter(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/^---[\s\S]*?---/);
  return !(m !== null && m[0].includes('last_updated'));
});
if (noMetaFiles.length > 0) {
  const names = noMetaFiles.slice(0, 5).map(f => path.relative(ROOT, f).replace(/\\/g, '/')).join(', ');
  warnings.push(`docs/ 缺元信息头 ${noMetaFiles.length} 个：${names}${noMetaFiles.length > 5 ? ' …' : ''}（新文档必须带 last_updated/status/owner，或跑 node scripts/add-doc-meta.cjs）`);
}

// 7b. docs 元信息头 status 值域（active|draft|deprecated）
const VALID_STATUS = new Set(['active', 'draft', 'deprecated']);
const badStatus = [];
for (const f of allDocs) {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/^---[\s\S]*?---/);
  if (!m) continue;
  const st = m[0].match(/^status:\s*(\S+)\s*$/m);
  if (st && !VALID_STATUS.has(st[1])) badStatus.push(path.relative(ROOT, f).replace(/\\/g, '/'));
}
if (badStatus.length > 0) {
  warnings.push(`docs/ 元信息头 status 值域异常 ${badStatus.length} 个：${badStatus.slice(0, 3).join(', ')}（合法值 active|draft|deprecated）`);
}

// 8. wiki 四件套存在性（工程结构.md §六：business-model / api-contract / data-model / glossary）
const WIKI_FOUR = ['business-model.md', 'api-contract.md', 'data-model.md', 'glossary.md'];
const wikiDir = path.join(ROOT, '.harness/wiki');
if (!fs.existsSync(wikiDir)) {
  errors.push('.harness/wiki/ 不存在（wiki 四件套缺失）');
} else {
  for (const wf of WIKI_FOUR) {
    if (!fs.existsSync(path.join(wikiDir, wf))) errors.push(`.harness/wiki/${wf} 缺失（wiki 四件套）`);
  }
}

// 9. .claude/agents 三子代理存在性（AGENTS.md §12 声明）
const CLAUDE_AGENTS = ['code-reviewer.md', 'consistency-verifier.md', 'red-line-auditor.md'];
const claudeDir = path.join(ROOT, '.claude/agents');
if (!fs.existsSync(claudeDir)) {
  warnings.push('.claude/agents/ 不存在（环境可用性依赖标注见开发流程规范 §四，缺目录不阻断）');
} else {
  for (const ca of CLAUDE_AGENTS) {
    if (!fs.existsSync(path.join(claudeDir, ca))) errors.push(`.claude/agents/${ca} 缺失（三子代理声明）`);
  }
}

// 10. docs/skills 审查页存在性（声明驱动：AGENTS.md §12 声明哪些就校验哪些，双向核对）
const docsSkillsDir = path.join(ROOT, 'docs/skills');
const docsSkillsClaim = agents.match(/`docs\/skills\/`[^\n]*（([^）]*)）/);
if (!docsSkillsClaim) {
  errors.push('AGENTS.md §12 未声明 docs/skills 审查页清单');
} else if (!fs.existsSync(docsSkillsDir)) {
  errors.push('docs/skills/ 不存在（核心技能人读审查页）');
} else {
  const declared = (docsSkillsClaim[1].match(/[A-Za-z0-9][A-Za-z0-9-]*/g) || []);
  if (declared.length === 0) errors.push('AGENTS.md §12 docs/skills 声明清单为空');
  for (const sp of declared) {
    if (!fs.existsSync(path.join(docsSkillsDir, `${sp}.md`))) errors.push(`docs/skills/${sp}.md 缺失（审查页声明）`);
  }
  // 反向核对：磁盘上多出未声明的页 → 警告（防补了页却忘在 AGENTS.md §12 登记）
  const onDisk = fs.readdirSync(docsSkillsDir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
  for (const f of onDisk) {
    if (!declared.includes(f)) warnings.push(`docs/skills/${f}.md 存在但 AGENTS.md §12 未声明`);
  }
}

// 11. changes 变更记录门禁：_template 三件套 + 每切片 review.md 存在且结论行格式合规
const changesDir = path.join(ROOT, '.harness/changes');
if (fs.existsSync(changesDir)) {
  const tpl = path.join(changesDir, '_template');
  for (const tf of ['summary.md', 'db-migrations.sql', 'rollback.sql']) {
    if (!fs.existsSync(path.join(tpl, tf))) errors.push(`.harness/changes/_template/${tf} 缺失（三件套模板）`);
  }
  const slices = fs.readdirSync(changesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_template')
    .map(d => d.name);
  for (const s of slices) {
    const sDir = path.join(changesDir, s);
    const rv = path.join(sDir, 'review.md');
    if (!fs.existsSync(rv)) {
      errors.push(`.harness/changes/${s}/review.md 缺失（每切片必须 review）`);
    } else {
      const rvText = fs.readFileSync(rv, 'utf8');
      // 结论行格式兼容历史变体：🔴 0 / 🟡 0、顿号/斜杠/逗号分隔、emoji 顺序可变、中文"零/清零/无"计数
      if (!/🔴\s*(清零?|无|[零0-9]+)[\s、,，/]*🟡\s*(清零?|无|[零0-9]+)/.test(rvText)) {
        errors.push(`.harness/changes/${s}/review.md 结论行缺格式（需 \`🔴 N 🟡 N\`）`);
      }
    }
    const sm = path.join(sDir, 'summary.md');
    if (!fs.existsSync(sm)) errors.push(`.harness/changes/${s}/summary.md 缺失（每切片必须 summary）`);
  }
}

// 输出
console.log('=== Harness 一致性体检 ===');
console.log(`AGENTS.md ${agentsLines} 行 | ADR ${adrNums.length} 个 | CI ${ciJobs} job | .agents/skills ${agentsSkillDirs} 个 | .harness/skills ${harnessTotal} 个`);
console.log(`CI jobs 进出: ci.yml ${ciJobs} [${ciJobsList.join(', ')}] vs AGENTS.md 声明 ${ciClaim ? ciClaim[1] : '（未声明）'}${ciClaim && ciJobs !== parseInt(ciClaim[1], 10) ? ' ⚠ 不一致' : ''}`);
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length === 0) {
  console.log('ERRORS: []');
  process.exit(0);
}
for (const e of errors) console.log(`❌ ${e}`);
console.log(`ERRORS: [${errors.length}]`);
process.exit(1);
