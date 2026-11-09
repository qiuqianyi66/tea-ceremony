#!/usr/bin/env node
/**
 * 技能分层升降体检（F11 后续）
 *
 * 背景：docs/reference/skill-layering.md 定了升降判据，但判据依赖「真实调用记录」。
 * 本脚本把纸面判据变成可跑的统计，并且**在样本不足时明确报「未测」**，
 * 不把「没有记录」读成「没被用过」（AGENTS.md §13 静默失效警觉）。
 *
 * 数据源（两个，各回答不同问题，不可互相替代）：
 *   1. docs/reference/skill-layering.md 的「活跃层」表格 → 活跃技能名单
 *   2. .harness/changes/<切片>/summary.md 的「调用技能」行 → 任务归属（「这个切片用了哪个技能」）
 *   3. 客户端会话轨迹（scripts/lib/trajectory-scan.cjs）→ 文件是否真被打开过（机器记录，不受人是否记得填影响）
 *
 * 为什么必须两个：留痕覆盖率长期只有个位数（39 个切片 1 条），只看它永远「未测」；
 * 轨迹样本够但缺任务归属（一个会话可能横跨多个主题）。一个给观测、一个给归属，缺任一个都判不了升降。
 *
 * 判据（照抄契约，不另行发明）：
 *   升：储备技能被真实任务点名 ≥ 3 次
 *   降：活跃技能连续 3 个切片零调用，且有同类技能覆盖
 *
 * 只报不阻断：样本不足时它会一直报「未测」，挂进 CI 只会变成永久噪音。
 */
const fs = require('fs')
const path = require('path')
const { scan, defaultSessionsDir } = require('./lib/trajectory-scan.cjs')

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
  const traj = scan({ sessionsDir: defaultSessionsDir(), repoMarks: ['Desktop/tea', ROOT] })
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
  // 轨迹观测：留痕覆盖率不足时的独立维度（机器记录，不受人是否记得填影响）
  console.log('## 轨迹观测（文件是否真被打开过）')
  if (traj.missing) {
    console.log(`- 未测：本机无会话轨迹目录（${traj.sessionsDir}）。缺目录不等于零读取。`)
  } else {
    const top = [...traj.skillReads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    console.log(
      `- 轨迹 ${traj.files} 个 | 技能正文读取 ${traj.entry.skillMd} 次 / ${traj.sessions.withSkillMd} 个会话` +
        ` | 读过任一入口的会话 ${traj.sessions.withAny} 个`,
    )
    console.log('- 读取最高：' + (top.length ? top.map(([n, v]) => `${n}(${v})`).join('、') : '无'))
    const trajZero = active.filter((a) => !traj.skillReads.has(a))
    console.log(`- 活跃层里轨迹零读取 ${trajZero.length}/${active.length} 个${trajZero.length ? `：${trajZero.join('、')}` : ''}`)
    const trajUp = [...traj.skillReads.entries()].filter(([n, v]) => v >= UP_THRESHOLD && !active.includes(n))
    console.log(
      '- 轨迹升候选（储备读出 ≥' + UP_THRESHOLD + ' 次）：' +
        (trajUp.length ? trajUp.map(([n, v]) => `${n}(${v})`).join('、') : '无'),
    )
    console.log('- 读法：轨迹能证「打开过」，证不了「这个任务该不该用它」；降级仍需留痕确认同类覆盖。')
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
    console.log(`留痕侧样本不足（有留痕切片 ${recorded.length} < ${DOWN_WINDOW}）：切片粒度的「连续 ${DOWN_WINDOW} 个切片零调用」本轮判不了。`)
    if (!traj.missing && traj.sessions.withSkillMd >= DOWN_WINDOW) {
      const trajZero = active.filter((a) => !traj.skillReads.has(a))
      console.log(`轨迹侧样本够（${traj.sessions.withSkillMd} 个会话读过技能正文）：`)
      console.log(`  能判的：活跃层里轨迹零读取的 ${trajZero.length} 个是降级强信号（仍需人工确认是否有同类技能覆盖）。`)
      console.log('  判不了的：时序判据（连续 N 个切片零调用）——轨迹里没有切片归属。')
    } else {
      console.log('轨迹侧也不足，两个源同时未满足 —— 本轮不动名单，这是「没测到」不是「没用过」。')
    }
  } else {
    console.log('样本满足，按上方候选人工复核后改 skill-layering.md 的活跃层表。')
    console.log('复核时同时看轨迹观测：留痕说「这个任务用了它」，轨迹说「文件被打开过」，两者不一致的地方要查原因。')
  }
  console.log('')
  console.log('## 全库被点过的技能（真实留痕）')
  if (allSkills.size === 0) console.log('无')
  else for (const [s, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${s}: ${n}`)
}

main()
