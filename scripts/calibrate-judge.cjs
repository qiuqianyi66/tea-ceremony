#!/usr/bin/env node
/**
 * LLM-as-Judge 校准（T12，F-A5）：人工标注 vs 机评一致率，阈值 85%。
 * 用法：
 *   node scripts/calibrate-judge.cjs samples.json      # 从文件读样本
 *   node scripts/calibrate-judge.cjs --demo            # 演示样本（85% 达标/不达标两种）
 * 样本结构：[{id, human: 0|1, machine: 0|1}]
 * 输出：一致率 + 明细 + PASS/FAIL（<85% 提示调评委 Prompt 重跑）
 */
const fs = require('node:fs')
const path = require('node:path')

const THRESHOLD = 0.85

function evaluate(samples) {
  // 三类样本分账，避免 UNKNOWN 被静默丢弃（缩小分母导致一致率虚高）
  const unknown = samples.filter((s) => s.human !== 0 && s.human !== 1 || (s.machine !== 0 && s.machine !== 1))
  const valid = samples.filter((s) => (s.human === 0 || s.human === 1) && (s.machine === 0 || s.machine === 1))
  const mismatches = valid.filter((s) => s.human !== s.machine)
  const unstable = valid.filter((s) => s.unstable === true)
  const rate = valid.length === 0 ? 0 : (valid.length - mismatches.length) / valid.length
  return { rate, mismatches, unstable, unknown, validCount: valid.length, total: samples.length }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  let samples
  if (args.includes('--demo')) {
    samples = demo()
  } else {
    const file = args[0]
    if (!file) { console.error('用法: node scripts/calibrate-judge.cjs <samples.json> | --demo'); process.exit(1) }
    samples = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  }

  const { rate, mismatches, unstable, unknown } = evaluate(samples)
  console.log(`样本: ${samples.length} 条（有效 ${samples.length - unknown.length}） | 一致率: ${(rate * 100).toFixed(1)}% | 阈值: ${THRESHOLD * 100}%`)
  if (unknown.length > 0) {
    console.log(`UNKNOWN 样本 ${unknown.length} 条（不计入一致率分母，需人工复核）: ${unknown.map((s) => s.id).join(', ')}`)
  }
  if (mismatches.length > 0) {
    console.log(`不一致 ${mismatches.length} 条:`)
    for (const m of mismatches) console.log(`  ${m.id} human=${m.human} machine=${m.machine}`)
  }
  if (unstable.length > 0) console.log(`A/B 不稳定 ${unstable.length} 条（需人工复核）: ${unstable.map((s) => s.id).join(', ')}`)
  if (rate >= THRESHOLD) console.log('PASS')
  else console.log('FAIL — 一致率低于 85%，调整评委 Prompt（docs/ai-eval/judge-prompts/）后重跑')
}

function demo() {
  // 8 条：7 一致 1 不一致 → 87.5% PASS；其中 1 条 A/B 不稳定
  return [
    { id: 'LIB-001', human: 1, machine: 1 },
    { id: 'LIB-002', human: 1, machine: 1 },
    { id: 'LIB-005', human: 1, machine: 1 },
    { id: 'ADV-001', human: 1, machine: 1 },
    { id: 'BRE-001', human: 1, machine: 1 },
    { id: 'TAS-001', human: 1, machine: 1 },
    { id: 'LIB-008', human: 1, machine: 0 },
    { id: 'CHA-002', human: 1, machine: 1, unstable: true },
  ]
}

module.exports = { evaluate, THRESHOLD }
