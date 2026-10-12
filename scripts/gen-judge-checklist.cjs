// 生成 T09 人工复核标注清单（临时工具）：从 T08 报告抽 judge 考点 → markdown 清单（含 AI 回答片段，便于快速标注）
const fs = require('node:fs')
const path = require('node:path')

const report = JSON.parse(fs.readFileSync(path.resolve('docs/ai-eval/reports/2026-10-12.json'), 'utf8'))
const lines = ['# T09 judge 人工复核清单（2026-10-12，T08 报告）', '',
  '> 规则：逐条看「AI 回答片段」是否真正满足「考点」。满足填 `1`，不满足填 `0`，拿不准填 `UNKNOWN`。',
  '> 标注入口：把每题末尾的 `human: null` 改成 `human: 1` / `human: 0` / `human: UNKNOWN`，改完保存，告诉我「标完了」即可。',
  '> 对照：machine 列是 deepseek 评委自动判分（仅参考，你独立判断）。', '']

const rows = []
for (const run of report.runs) {
  for (const p of run.points || []) {
    if (p.check !== 'judge') continue
    if (p.score === 'UNKNOWN') continue
    rows.push({
      id: `${run.id}::${p.name}`,
      snippet: (run.contentSnippet || '').replace(/\n/g, ' ').slice(0, 220),
      machine: p.score === 1 ? 1 : 0,
    })
  }
}
lines.push(`共 ${rows.length} 条 judge 考点（UNKNOWN 已剔除，不参与一致率分母）`, '')
for (const r of rows) {
  lines.push(`---`, `### ${r.id}`, `- **考点**：${r.id.split('::')[1]}`, `- **AI 回答片段**：${r.snippet}`, `- **machine（deepseek 评委）**：${r.machine}`, `- **human（你来判）**：null`, '')
}
fs.writeFileSync(path.resolve('docs/ai-eval/T09-annotation-checklist.md'), lines.join('\n'))
console.log(`清单 ${rows.length} 条已写入 docs/ai-eval/T09-annotation-checklist.md`)
