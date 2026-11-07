#!/usr/bin/env node
/**
 * 技能分层升降体检（F11 后续）
 *
 * 背景：docs/reference/skill-layering.md 定了升降判据，但判据依赖「真实调用记录」。
 * 本脚本把纸面判据变成可跑的统计，并且**在样本不足时明确报「未测」**，
 * 不把「没有记录」读成「没被用过」（AGENTS.md §13 静默失效警觉）。
 *
 * 数据源：
 *   1. docs/reference/skill-layering.md 的「活跃层」表格 → 活跃技能名单
 *   2. .harness/changes/<切片>/summary.md 的「调用技能」行 → 真实留痕
 *
 * 判据（照抄契约，不另行发明）：
 *   升：储备技能被真实任务点名 ≥ 3 次
 *   降：活跃技能连续 3 个切片零调用，且有同类技能覆盖
 *
 * 只报不阻断：样本不足时它会一直报「未测」，挂进 CI 只会变成永久噪音。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const LAYERING = path.join(ROOT, 'docs/reference/skill-layering.md')
const CHANGES = path.join(ROOT, '.harness/changes')

const UP_THRESHOLD = 3 // 储备点名 ≥3 次则升
const DOWN_WINDOW = 3 // 活跃连续 3 个切片零调用则降

/** 剥掉目录名的 NN- 前缀，与 audit-skill-usage 口径一致 */
const normalize = (s) => s.trim().replace(/^\d+-/, '').replace(/^`|`$/g, '').trim()

function activeSkills() {
  const text = fs.readFileSync(LAYERING, 'utf8')
  const start = text.indexOf('## 活跃层')
  const end = text.indexOf('## 储备层')
  if (start < 0 || end < 0) throw new Error('skill-layering.md 缺「## 活跃层」或「## 储备层」小节')
  const section = text.slice(start, end)
  const names = []
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    // 表格：| 族 | 技能 |  → cells[0]='' cells[1]=族 cells[2]=技能
    if (cells.length < 3) continue
    const cell = cells[2]
    if (!cell || /^-+$/.test(cell) || cell === '技能') continue
    for (const n of cell.split('、')) {
      const name = normalize(n)
      if (name) names.push(name)
    }
  }
  return names
}

/** 读全部切片的「调用技能」行，返回 [{slice, skills:[]}] */
function sliceRecords() {
  const dirs = fs.readdirSync(CHANGES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_template')
    .map((d) => d.name)
  const out = []
  for (const d of dirs) {
    const sm = path.join(CHANGES, d, 'summary.md')
    if (!fs.existsSync(sm)) { out.push({ slice: d, skills: [], hasFile: false }); continue }
    const text = fs.readFileSync(sm, 'utf8')
    const skills = []
    for (const line of text.split('\n')) {
      if (!line.includes('调用技能')) continue
      if (!line.startsWith('|')) continue
      const cells = line.split('|').map((c) => c.trim())
      // 只认第一列就是「调用技能」的行；summary 里叙述性文字也会提到「调用技能」，
      // 不卡这一列会把描述句当成调用记录。
      if (cells[1] !== '调用技能') continue
      const val = cells[2] || ''
      if (!val || val === '无' || /^\{.*\}$/.test(val)) continue
      for (const n of val.split(/[、,，/]/)) {
        const name = normalize(n)
        if (name) skills.push(name)
      }
    }
    out.push({ slice: d, skills, hasFile: true })
  }
  return out
}

function main() {
  const active = activeSkills()
  const records = sliceRecords()
  const allSkills = new Set()
  const counts = new Map()
  for (const r of records) {
    for (const s of r.skills) {
      allSkills.add(s)
      counts.set(s, (counts.get(s) || 0) + 1)
    }
  }

  const recorded = records.filter((r) => r.skills.length > 0)
  const coverage = records.length ? (recorded.length / records.length) * 100 : 0

  console.log('=== 技能分层升降体检 ===')
  console.log(`活跃层 ${active.length} 个 | 切片 ${records.length} 个 | 有留痕 ${recorded.length} 个（覆盖率 ${coverage.toFixed(1)}%）`)
  console.log('')

  // 活跃层逐项：0 表示「未留痕」，不是「没用过」
  const activeZero = []
  console.log('## 活跃层调用情况（0 = 未留痕，≠ 没用过）')
  for (const a of active) {
    const n = counts.get(a) || 0
    if (n === 0) activeZero.push(a)
    console.log(`- ${a}: ${n}`)
  }
  console.log('')

  console.log('## 升降候选')
  const up = [...counts.entries()].filter(([s, n]) => n >= UP_THRESHOLD && !active.includes(s))
  if (up.length === 0) {
    console.log(`- 升（储备点名 ≥${UP_THRESHOLD} 次）：无（当前最高 ${Math.max(0, ...counts.values())} 次）`)
  } else {
    for (const [s, n] of up) console.log(`- 升：${s}（${n} 次）`)
  }

  if (recorded.length < DOWN_WINDOW) {
    console.log(`- 降（活跃连续 ${DOWN_WINDOW} 切片零调用）：**未测** —— 有留痕切片仅 ${recorded.length} 个，不足 ${DOWN_WINDOW} 个的最小样本`)
  } else {
    // 按切片目录名排序近似时间序；只统计有留痕的切片，避免把「没写」当「没调用」
    const ordered = recorded.slice().sort((a, b) => a.slice.localeCompare(b.slice))
    const tail = ordered.slice(-DOWN_WINDOW)
    const down = active.filter((a) => tail.every((r) => !r.skills.includes(a)))
    if (down.length === 0) console.log(`- 降：无（最近 ${DOWN_WINDOW} 个有留痕切片里活跃层都有调用）`)
    else for (const d of down) console.log(`- 降候选：${d}（最近 ${DOWN_WINDOW} 个有留痕切片零调用，仍需人工确认是否有同类覆盖）`)
  }
  console.log('')

  console.log('## 结论')
  if (recorded.length < DOWN_WINDOW) {
    console.log(`判据未满足最小样本（有留痕切片 ${recorded.length} < ${DOWN_WINDOW}），本轮不动名单。`)
    console.log('这不是「活跃层没用」，是本项目目前只跑过 ' + recorded.length + ' 条带留痕的真实任务。')
  } else {
    console.log('样本满足，按上方候选人工复核后改 skill-layering.md 的活跃层表。')
  }
  console.log('')
  console.log('## 全库被点过的技能（真实留痕）')
  if (allSkills.size === 0) console.log('无')
  else for (const [s, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${s}: ${n}`)
}

main()
