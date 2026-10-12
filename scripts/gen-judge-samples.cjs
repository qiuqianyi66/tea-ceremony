// 生成 T09 校准样本（临时工具）：从 T08 报告（2026-10-12.json）抽 judge 考点判分 → samples.json
// machine 判分自动填入；human 字段留 null，待人工独立复核后跑 calibrate-judge.cjs
const fs = require('node:fs')
const path = require('node:path')

const report = JSON.parse(fs.readFileSync(path.resolve('docs/ai-eval/reports/2026-10-12.json'), 'utf8'))
const samples = []
for (const run of report.runs) {
  for (const p of run.points || []) {
    if (p.check !== 'judge') continue
    if (p.score === 'UNKNOWN') continue // UNKNOWN 不参与一致率分母
    samples.push({ id: `${run.id}::${p.name}`, human: null, machine: p.score === 1 ? 1 : 0 })
  }
}
fs.writeFileSync(path.resolve('docs/ai-eval/samples-judge-t09.json'), JSON.stringify(samples, null, 2))
console.log(`样本 ${samples.length} 条已写入 docs/ai-eval/samples-judge-t09.json（human 待人工复核）`)
