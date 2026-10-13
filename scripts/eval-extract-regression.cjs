#!/usr/bin/env node
/**
 * K17 Trace→回归样本提取器：从 eval report JSON 提取失败 case → 回归样本 md。
 * 约定：评测后 bad case 归因 → 修复验证通过 → 从回归样本删除该行（防复发盯防）。
 * 用法：node scripts/eval-extract-regression.cjs [report.json] [-o out.md]
 * 默认：docs/ai-eval/reports/2026-10-12.json → docs/ai-eval/regression-cases.md
 * 幂等：同报告同 id 已存在则跳过；新报告追加新分区。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const reportPath = args[0] || path.join(ROOT, 'docs/ai-eval/reports/2026-10-12.json');
const outPath = args.indexOf('-o') !== -1 ? args[args.indexOf('-o') + 1] : path.join(ROOT, 'docs/ai-eval/regression-cases.md');

if (!fs.existsSync(reportPath)) {
  console.error(`report not found: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const runs = report.runs || [];
const date = report.date || path.basename(reportPath, '.json');

// 失败判定：score < 1（确定失败）或 pass3 未过（波动型，防不稳定回归）
const failed = runs.filter(r => (r.score ?? 1) < 1 || (r.passResult && !r.passResult.passed));

const rowOf = (r) => {
  const failedPoints = (r.points || []).filter(p => (p.score ?? 1) < 1).map(p => p.name).join('; ') || '—';
  const input = (r.input || '').replace(/\s+/g, ' ').slice(0, 60);
  return `| ${r.id} | ${r.file} | ${r.type} | ${input} | ${failedPoints} | ${r.score ?? '?'} | ${r.passResult ? `${r.passResult.passedCount}/${r.passResult.k}` : '—'} |`;
};

if (failed.length === 0) {
  console.log(`no failed cases in ${reportPath}`);
  process.exit(0);
}

const header = [
  '',
  `## ${date}（overall ${report.aggregate?.overall ?? '?'}，失败 ${failed.length}/${runs.length}）`,
  '',
  '| id | file | type | input | 失败考点 | score | pass³ |',
  '|---|---|---|---|---|---|---|',
  ...failed.map(rowOf),
];

const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
const existingIds = new Set([...existing.matchAll(/\| ([\w-]+) \|/g)].map(m => m[1]));
const newRows = failed.filter(r => !existingIds.has(r.id));
if (newRows.length === 0) {
  console.log(`all ${failed.length} failed cases already in regression set`);
  process.exit(0);
}

const body = header.join('\n');
const content = existing === ''
  ? `# AI 评测回归样本（K17）\n\n> 规则：每次评测后运行本脚本，bad case 自动入表；归因修复并验证通过后删除对应行。\n${body}\n`
  : `${existing.replace(/\s+$/, '')}\n${body}\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`regression cases: ${newRows.length} added (${failed.length} failed in report) -> ${path.relative(ROOT, outPath)}`);
