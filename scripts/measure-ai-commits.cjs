#!/usr/bin/env node
/**
 * K20 结果度量：AI 提交占比。
 * 约定（AGENTS.md §10）：2026-10-13 起，AI 代理提交的 subject 前加 `[ai]` 标记。
 * 用法：node scripts/measure-ai-commits.cjs [since] [--json]
 * since 默认 2026-10-13（约定生效日）；--json 输出结构化结果。
 */
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const since = args.find(a => !a.startsWith('--')) || '2026-10-13';
const asJson = args.includes('--json');

const log = execSync(
  `git log --since="${since}" --pretty=format:%s%n%b%x1e`,
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
);

const subjects = log.split('\x1e').map(s => s.split('\n')[0].trim()).filter(Boolean);
const total = subjects.length;
const ai = subjects.filter(s => /^\[ai\]/i.test(s)).length;
const human = total - ai;
const pct = total === 0 ? 0 : (ai / total * 100);

if (asJson) {
  console.log(JSON.stringify({ since, total, ai, human, aiPct: Number(pct.toFixed(2)) }, null, 2));
} else {
  console.log(`AI 提交占比（since ${since}）`);
  console.log(`总提交 ${total} | AI ${ai} | 人工 ${human} | AI 占比 ${pct.toFixed(1)}%`);
  if (ai === 0 && total > 0) {
    console.log('提示：约定生效前无 [ai] 标记；2026-10-13 起的 AI 提交应带 [ai] 前缀（AGENTS.md §10）。');
  }
}
