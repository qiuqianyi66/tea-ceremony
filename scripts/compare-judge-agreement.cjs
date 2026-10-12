// 评委间一致性对比（临时工具）：2026-10-10.json（通义 judge）vs 2026-10-12.json（deepseek judge）
// 按 (id, pointName) 对齐 judge 考点判分，输出一致率 + 不一致清单
const fs = require('node:fs')
const path = require('node:path')

const oldReport = JSON.parse(fs.readFileSync(path.resolve('docs/ai-eval/reports/2026-10-10.json'), 'utf8'))
const newReport = JSON.parse(fs.readFileSync(path.resolve('docs/ai-eval/reports/2026-10-12.json'), 'utf8'))

function judgeMap(report) {
  const m = new Map()
  for (const run of report.runs) {
    for (const p of run.points || []) {
      if (p.check !== 'judge') continue
      const key = `${run.id}::${p.name}`
      m.set(key, p.score) // 0 | 1 | 'UNKNOWN'
    }
  }
  return m
}

const oldMap = judgeMap(oldReport)
const newMap = judgeMap(newReport)

const keys = [...new Set([...oldMap.keys(), ...newMap.keys()])]
const both = keys.filter((k) => oldMap.has(k) && newMap.has(k))
const oldOnly = keys.filter((k) => oldMap.has(k) && !newMap.has(k))
const newOnly = keys.filter((k) => newMap.has(k) && !oldMap.has(k))

const bothVal = both.filter((k) => oldMap.get(k) === 1 && newMap.get(k) === 1).length
const bothZero = both.filter((k) => oldMap.get(k) === 0 && newMap.get(k) === 0).length
const bothUnknown = both.filter((k) => oldMap.get(k) === 'UNKNOWN' && newMap.get(k) === 'UNKNOWN').length
const agree = both.filter((k) => String(oldMap.get(k)) === String(newMap.get(k))).length
const disagree = both.filter((k) => String(oldMap.get(k)) !== String(newMap.get(k)))

console.log(`judge 考点总数: 旧=${oldMap.size} 新=${newMap.size} 交集=${both.length} 旧独有=${oldOnly.length} 新独有=${newOnly.length}`)
console.log(`交集一致率: ${(agree / both.length * 100).toFixed(1)}% (${agree}/${both.length})`)
console.log(`  一致明细: 都1=${bothVal} 都0=${bothZero} 都UNKNOWN=${bothUnknown}`)
console.log(`不一致 ${disagree.length} 条:`)
for (const k of disagree) console.log(`  ${k} | 通义=${oldMap.get(k)} deepseek=${newMap.get(k)}`)
