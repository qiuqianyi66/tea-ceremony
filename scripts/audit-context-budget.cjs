#!/usr/bin/env node
/**
 * 常驻上下文预算体检（token 成本可观测门禁）。
 *
 * 常驻层（AGENTS.md / CLAUDE.md / CONTEXT.md / .harness/rules/*.md）每个会话每一轮都重复
 * 付费，是唯一能一次性根治的 token 开支。本脚本把它变成可见、可回归的数字。
 * 背景与优化手段见 docs/token-optimization-guide.md。
 *
 * 估算口径（非实测 tokenizer，保守）：ASCII 字符 ÷ 3.8 + CJK 字符 ÷ 1.5。
 * 用途：对比优化前后、防止常驻层重新膨胀。不要用它替代真实 usage 计数。
 *
 * 用法：
 *   node scripts/audit-context-budget.cjs                      全量报告 + 预算检查
 *   node scripts/audit-context-budget.cjs --sections AGENTS.md 单文件分节占比
 * 超预算 exit 1；正常 exit 0。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 常驻层：每次会话都会被读入上下文的文件
const FIXED = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md'];
const RULES_DIR = '.harness/rules';

// 预算（估算 token）。达标即停：不要为了让数字更好看而继续砍规则。
// 棘轮史：总预算 21,000（R1 建档）→ 19,500（R5 压缩编码规范/开发流程规范/CONTEXT 后收紧）。
// 每次常驻层净压降后应同步收紧（只许收紧，防重新膨胀）；单文件预算给 ~8-10% 增长余量。
const PER_FILE_BUDGET = {
  'AGENTS.md': 7000,
  '.harness/rules/编码规范.md': 3900,
  '.harness/rules/开发流程规范.md': 3200,
  'CONTEXT.md': 1400,
};
const TOTAL_BUDGET = 19500;

function read(p) {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
}

function estimate(text) {
  const cjk = (text.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/g) || []).length;
  const ascii = text.length - cjk;
  return Math.round(cjk / 1.5 + ascii / 3.8);
}

function alwaysOnFiles() {
  const rulesDir = path.join(ROOT, RULES_DIR);
  const rules = fs.existsSync(rulesDir)
    ? fs
        .readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => `${RULES_DIR}/${f}`)
    : [];
  return [...FIXED, ...rules];
}

function measure(rel) {
  const text = read(rel);
  if (text === null) return null;
  const est = estimate(text);
  const cjk = (text.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/g) || []).length;
  return {
    file: rel,
    chars: text.length,
    cjk,
    est,
    lines: text.split(/\r?\n/).length,
  };
}

function sections(rel) {
  const text = read(rel);
  if (text === null) {
    console.log(`未找到文件：${rel}`);
    return;
  }
  const lines = text.split(/\r?\n/);
  const starts = [];
  lines.forEach((l, i) => {
    if (/^#{1,3} /.test(l)) starts.push(i);
  });
  starts.push(lines.length);
  const rows = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const body = lines.slice(starts[i], starts[i + 1] - 1).join('\n');
    rows.push({
      section: lines[starts[i]].replace(/^#+\s*/, ''),
      lines: starts[i + 1] - starts[i],
      chars: body.length,
      est: estimate(body),
    });
  }
  rows.sort((a, b) => b.est - a.est);
  console.log(`=== ${rel} 分节 token 占比（估算）===`);
  let sum = 0;
  for (const r of rows) {
    sum += r.est;
    const share = ((r.est / estimate(text)) * 100).toFixed(1);
    console.log(`${r.est}\t${share}%\t${r.lines}行\t${r.section}`);
  }
  console.log(`分节合计：${sum} / 全文 ${estimate(text)}（估算 token）`);
}

const args = process.argv.slice(2);
if (args[0] === '--sections' && args[1]) {
  sections(args[1]);
  process.exit(0);
}

const errors = [];
const rows = alwaysOnFiles()
  .map(measure)
  .filter(Boolean)
  .sort((a, b) => b.est - a.est);

console.log('=== 常驻上下文预算体检（估算口径 ASCII/3.8 + CJK/1.5）===');
let totalChars = 0;
let totalEst = 0;
for (const r of rows) {
  totalChars += r.chars;
  totalEst += r.est;
  const budget = PER_FILE_BUDGET[r.file];
  const mark = budget && r.est > budget ? `  <-- 超预算 ${budget}（+${r.est - budget}）` : '';
  if (budget && r.est > budget) {
    errors.push(`${r.file} 估算 ${r.est} token，超单文件预算 ${budget}`);
  }
  console.log(
    `${r.file}\t${r.chars} 字符\t${r.est} token\t${r.lines} 行${budget ? `\t预算 ${budget}` : ''}${mark}`,
  );
}
console.log(`常驻层合计：${totalChars} 字符 ≈ ${totalEst} token（总预算 ${TOTAL_BUDGET}）`);
if (totalEst > TOTAL_BUDGET) {
  errors.push(`常驻层合计估算 ${totalEst} token，超总预算 ${TOTAL_BUDGET}`);
}

console.log(`ERRORS: [${errors.join(' | ')}]`);
process.exit(errors.length ? 1 : 0);
