#!/usr/bin/env node
/**
 * 评测集结构校验（T10 交付门禁，T11 评测器前置）。
 * 检查：YAML 可解析 / cases ≥8 每文件 / id 唯一 / type 合法与分布 / points 字段完整（name/weight/veto/check）。
 * 期望输出：VALID + 计数；任何违规 → ERRORS 列表 + exit 1。
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const CASES_DIR = path.join(__dirname, '..', 'docs', 'ai-eval', 'cases')
const FILES = ['advisor.yaml', 'taster.yaml', 'librarian.yaml', 'brewer.yaml', 'mentor.yaml', 'chat.yaml']
const TYPES = ['typical', 'edge', 'adversarial']
const CHECKS = ['program', 'judge']

const errors = []
const ids = new Set()
let total = 0
const typeCount = { typical: 0, edge: 0, adversarial: 0 }

for (const file of FILES) {
  const full = path.join(CASES_DIR, file)
  if (!fs.existsSync(full)) {
    errors.push(`缺失文件: ${file}`)
    continue
  }
  let doc
  try {
    doc = yaml.load(fs.readFileSync(full, 'utf8'))
  } catch (e) {
    errors.push(`${file} YAML 解析失败: ${e.message}`)
    continue
  }
  const cases = doc?.cases
  if (!Array.isArray(cases)) {
    errors.push(`${file} 缺 cases 数组`)
    continue
  }
  if (cases.length < 8) {
    errors.push(`${file} cases=${cases.length} < 8`)
  }
  for (const c of cases) {
    total++
    if (ids.has(c.id)) errors.push(`id 重复: ${c.id}`)
    ids.add(c.id)
    if (!TYPES.includes(c.type)) errors.push(`${c.id} type 非法: ${c.type}`)
    else typeCount[c.type]++
    if (typeof c.input !== 'string') errors.push(`${c.id} 缺 input`)
    if (typeof c.expected !== 'string' || c.expected.trim() === '') errors.push(`${c.id} 缺 expected`)
    if (!Array.isArray(c.points) || c.points.length === 0) {
      errors.push(`${c.id} 缺 points`)
      continue
    }
    for (const p of c.points) {
      if (typeof p.name !== 'string' || p.name === '') errors.push(`${c.id} point 缺 name`)
      if (typeof p.weight !== 'number' || p.weight <= 0) errors.push(`${c.id} point weight 非法: ${p.name}`)
      if (typeof p.veto !== 'boolean') errors.push(`${c.id} point veto 非法: ${p.name}`)
      if (!CHECKS.includes(p.check)) errors.push(`${c.id} point check 非法: ${p.name}`)
    }
  }
}

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`
console.log(`评测集: ${total} 条 (${FILES.length} 文件)`)
console.log(`分布: typical ${typeCount.typical} (${pct(typeCount.typical)}) / edge ${typeCount.edge} (${pct(typeCount.edge)}) / adversarial ${typeCount.adversarial} (${pct(typeCount.adversarial)})`)
if (errors.length > 0) {
  console.error(`ERRORS (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('VALID')
