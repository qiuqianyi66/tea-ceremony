#!/usr/bin/env node
/**
 * Harness 一致性体检（doc-gardening，Harness 285「熵管理」落地 / PLAN P1-R4）。
 *
 * 检查 AGENTS.md 声明的治理数字 vs 仓库实际，漂移即报错：
 *   1. ADR 编号连续性 + AGENTS.md 声明值 vs docs/ADR 实际
 *   2. CI job 数声明 vs .github/workflows/ci.yml 实际
 *   3. 技能数量声明（.agents/skills 66、.harness/skills 32） vs 实际目录
 *   4. 关键路径引用（docs/ .harness/ .agents/ scripts/）存在性
 *   5. AGENTS.md 行数（维护规则 200-350）
 *
 * 用法：node scripts/verify-harness.cjs   期望输出 ERRORS: []
 * 有错误 exit 1（可挂 CI），无错误 exit 0。
 */
const fs = require('fs');
const path = require('path');

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
if (!ci) {
  errors.push('.github/workflows/ci.yml 不存在');
} else {
  const jobsIdx = ci.search(/^jobs:$/m);
  const jobsBody = jobsIdx >= 0 ? ci.slice(jobsIdx) : ci;
  ciJobs = (jobsBody.match(/^  [a-z][a-z0-9-]*:$/gm) || []).length;
  const claim = agents.match(/CI (\d+) job/);
  if (claim && ciJobs !== parseInt(claim[1], 10)) {
    errors.push(`AGENTS.md 声明 CI ${claim[1]} job，ci.yml 实际 ${ciJobs} job`);
  }
}

// 4. 技能数量一致性
const agentsSkillDirs = countSkillDirs(path.join(ROOT, '.agents/skills'));
const skillsClaim = agents.match(/技能路由总表（(\d+) 个）/);
if (skillsClaim && agentsSkillDirs !== parseInt(skillsClaim[1], 10)) {
  errors.push(`AGENTS.md 声明 .agents/skills 技能 ${skillsClaim[1]} 个，实际 ${agentsSkillDirs} 个`);
}

const families = ['main-dev', 'biz-dev', 'trouble-shooting'];
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

// 5. 关键路径引用存在性（AGENTS.md 中 docs/ .harness/ .agents/ scripts/ 开头的反引号路径）
const seen = new Set();
const pathRefs = agents.match(/`((?:docs|\.harness|\.agents|scripts)\/[^`]+)`/g) || [];
for (const raw of pathRefs) {
  const p = raw.slice(1, -1);
  if (seen.has(p) || /\s/.test(p) || p.includes('*')) continue;   // 带空格/通配符的是命令或 glob，跳过
  seen.add(p);
  if (!fs.existsSync(path.join(ROOT, p))) errors.push(`AGENTS.md 引用路径不存在：${p}`);
}

// 6. 285 docs 分层惯例：plans/ 与 reference/ 目录存在（工程结构.md §六）
for (const sub of ['docs/plans', 'docs/reference']) {
  if (!fs.existsSync(path.join(ROOT, sub))) {
    errors.push(`docs 分层缺失：${sub}/（285 结构化知识库模板，见工程结构.md §六）`);
  }
}

// 7. docs/ 元信息头覆盖率（doc-gardening 扫描依据；warning 不阻断，缺头文件始终列出）
function walkDir(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkDir(path.join(dir, e.name), acc);
    else if (e.name.endsWith('.md')) acc.push(path.join(dir, e.name));
  }
}
const allDocs = [];
if (fs.existsSync(path.join(ROOT, 'docs'))) walkDir(path.join(ROOT, 'docs'), allDocs);
const noMetaFiles = allDocs.filter(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/^---[\s\S]*?---/);
  return !(m !== null && m[0].includes('last_updated'));
});
if (noMetaFiles.length > 0) {
  const names = noMetaFiles.slice(0, 5).map(f => path.relative(ROOT, f).replace(/\\/g, '/')).join(', ');
  warnings.push(`docs/ 缺元信息头 ${noMetaFiles.length} 个：${names}${noMetaFiles.length > 5 ? ' …' : ''}（新文档必须带 last_updated/status/owner，或跑 node scripts/add-doc-meta.cjs）`);
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

// 10. docs/skills 审查页存在性（AGENTS.md §12 声明 6 页）
const SKILL_PAGES = ['plan-control.md', 'tea-tasting.md', 'db-migration.md', 'fastapi-endpoint.md', 'vue-component.md', 'caveman-review.md'];
const docsSkillsDir = path.join(ROOT, 'docs/skills');
if (!fs.existsSync(docsSkillsDir)) {
  errors.push('docs/skills/ 不存在（核心技能人读审查页）');
} else {
  for (const sp of SKILL_PAGES) {
    if (!fs.existsSync(path.join(docsSkillsDir, sp))) errors.push(`docs/skills/${sp} 缺失（审查页声明）`);
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
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length === 0) {
  console.log('ERRORS: []');
  process.exit(0);
}
for (const e of errors) console.log(`❌ ${e}`);
console.log(`ERRORS: [${errors.length}]`);
process.exit(1);
