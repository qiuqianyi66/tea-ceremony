#!/usr/bin/env node
/**
 * K18 eval 历史基线自动 diff：扫描 docs/ai-eval/reports/*.json，输出版本对比表。
 * 口径警示：v1/v2 为 judge off 的 program-only 口径（judgeCoverage 0），v3+ 才可跨比；
 * 表中 judgeCoverage 字段用于防误比。
 * 用法：node scripts/eval-baseline-diff.cjs [-o docs/ai-eval/baseline-diff.md]
 * 默认 stdout；-o 写 markdown 文件。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dir = path.join(ROOT, 'docs/ai-eval/reports');
const args = process.argv.slice(2);
const outFile = args.indexOf('-o') !== -1 ? path.join(ROOT, args[args.indexOf('-o') + 1]) : null;

const rows = fs.readdirSync(dir)
  .filter(f => /\.json$/.test(f) && !/dry/.test(f))  // dry-run 小样本不计入基线
  .map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
  })
  .filter(Boolean)
  .map(r => {
    const a = r.aggregate || {};
    const d = a.dimensions || {};
    return {
      date: r.date || path.basename('?'),
      overall: a.overall ?? '?',
      resultQuality: d.resultQuality ?? '?',
      processQuality: d.processQuality ?? '?',
      safetyStability: d.safetyStability ?? '?',
      pass3: a.pass3 ? `${a.pass3.passed}/${a.pass3.total}` : '—',
      judgeCoverage: a.judgeCoverage ?? 0,
      programOnly: a.programOnly ?? '?',
      cases: r.cases ?? '?',
    };
  })
  .sort((x, y) => x.date.localeCompare(y.date));

if (rows.length === 0) {
  console.error('no eval reports found');
  process.exit(1);
}

const line = r => `| ${r.date} | ${r.overall} | ${r.resultQuality} | ${r.processQuality} | ${r.safetyStability} | ${r.pass3} | ${r.cases} | ${r.judgeCoverage} | ${r.programOnly} |`;
const out = [
  '# AI 评测基线 diff（K18）',
  '',
  '> 口径：judgeCoverage = 1 才可与 v3+ 跨比；v1/v2 是 program-only（judgeCoverage 0），overall 不可直接比。',
  '',
  '| date | overall | resultQuality | processQuality | safetyStability | pass³ | cases | judgeCoverage | programOnly |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(line),
  '',
].join('\n');

if (outFile) {
  fs.writeFileSync(outFile, out, 'utf8');
  console.log(`baseline diff written: ${path.relative(ROOT, outFile)} (${rows.length} reports)`);
} else {
  console.log(out);
}
