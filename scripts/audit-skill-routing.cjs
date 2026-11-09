#!/usr/bin/env node
/**
 * 技能路由审计（活跃层 20 条的「可区分性」体检）
 *
 * 为什么不做「真触发评测」：
 *   外部做法（Anthropic skill-creator 的 trigger eval、SWEStash 的 routing benchmark）都要真调模型，
 *   跑 3 次取触发率、按 accept-set 判分。tea 不接外部模型调用，硬做只能靠规则猜，
 *   那是假验证。所以这里只算**文本层可判定**的三件事：
 *
 *   1. 预算：活跃层元数据总量 vs 客户端 listing 预算（外部实测约 20-22 条 / 200k 窗口）
 *   2. 唯一性：每条 description 的「独有词」有多少也出现在别的技能描述里 —— 共有词越多越难区分
 *      （相似度会被公共模板词和同族前缀污染，实测 108 条里有 1505 对 ≥0.2，几乎全是三项式前缀造成的假阳性）
 *   3. 结构：单条超长 / 非中文主导 / 与其他条共用开头模板
 *
 * 只报不阻断。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SKILL_ROOTS = ['.agents/skills', '.harness/skills']
const LAYERING = path.join(ROOT, 'docs/reference/skill-layering.md')

// 外部实测：Claude Code 把 name+description 注入 listing，上限约上下文 1%（200k 窗口 ≈ 20-22 条）
const LISTING_CAP = 22
const BUDGET_TOKENS = 2000

/** 与 audit-context-budget 同口径：ASCII/3.8 + CJK/1.5 */
function estimateTokens(text) {
  const ascii = (text.match(/[\x00-\x7F]/g) || []).length
  const cjk = text.length - ascii
  return Math.round(ascii / 3.8 + cjk / 1.5)
}

function walk(dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) walk(p, out)
    else if (d.name === 'SKILL.md') out.push(p)
  }
  return out
}

function loadSkills() {
  const files = []
  for (const r of SKILL_ROOTS) walk(path.join(ROOT, r), files)
  const map = new Map()
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    const fm = text.split('---')[1] || ''
    const name = ((fm.match(/^name:\s*(.+)$/m) || [])[1] || path.basename(path.dirname(f))).trim()
    const desc = ((fm.match(/^description:\s*(.+)$/m) || [])[1] || '').trim()
    const body = text.replace(/^---[\s\S]*?---/, '')
    if (!map.has(name)) map.set(name, { name, desc, body, rel: path.relative(ROOT, f).replace(/\\/g, '/') })
  }
  return map
}

function activeNames() {
  const text = fs.readFileSync(LAYERING, 'utf8')
  const start = text.indexOf('## 活跃层')
  const end = text.indexOf('## 储备层')
  if (start < 0 || end < 0) throw new Error('skill-layering.md 缺活跃层或储备层小节')
  const names = []
  for (const line of text.slice(start, end).split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 3) continue
    const cell = cells[2]
    if (!cell || cell === '技能' || /^-+$/.test(cell)) continue
    for (const n of cell.split('、')) {
      const name = n.trim().replace(/^\d+-/, '')
      if (name) names.push(name)
    }
  }
  return names
}

/** 词元：英文按词（长度>2），中文按 2-gram */
function tokens(text) {
  const out = new Set()
  const clean = text.toLowerCase().replace(/[`*|]/g, ' ')
  for (const w of clean.split(/[^\w\u4e00-\u9fa5]+/).filter(Boolean)) {
    if (/^[a-z0-9]+$/.test(w) && w.length > 2) out.add(`w:${w}`)
  }
  const cjk = clean.replace(/[^\u4e00-\u9fa5]/g, ' ')
  for (const seg of cjk.split(/\s+/).filter(Boolean)) {
    for (let i = 0; i < seg.length - 1; i++) out.add(`c:${seg.slice(i, i + 2)}`)
  }
  return out
}

/** 中文占比：中文字符 / 有效字符 */
function zhRatio(text) {
  const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const alnum = (text.match(/[A-Za-z0-9]/g) || []).length
  const total = zh + alnum
  return total ? zh / total : 0
}

function main() {
  const skills = loadSkills()
  const active = activeNames().filter((n) => skills.has(n))
  const missing = activeNames().filter((n) => !skills.has(n))
  const totalChars = active.reduce((s, n) => s + skills.get(n).desc.length, 0)
  const totalTokens = estimateTokens(active.map((n) => skills.get(n).desc).join(''))

  console.log('=== 技能路由审计（活跃层可区分性）===')
  console.log(`活跃层 ${active.length} 个（名单里缺库 ${missing.length} 个）| 元数据 ${totalChars} 字符 ≈ ${totalTokens} token | 预算 ${BUDGET_TOKENS} | listing 上限约 ${LISTING_CAP} 条`)
  if (missing.length) console.log(`⚠ 名单有但库里没有：${missing.join(', ')}`)
  const over = totalTokens > BUDGET_TOKENS
  console.log(over ? '❌ 超预算' : '✅ 预算内')
  console.log('')

  // 唯一性：独有词在其他技能描述中的复现比例
  const tok = new Map(active.map((n) => [n, tokens(skills.get(n).desc)]))
  const df = new Map()
  for (const [, set] of tok) for (const t of set) df.set(t, (df.get(t) || 0) + 1)

  console.log('## 一、唯一性（独有词被其他技能描述复现的比例）')
  console.log('比例越高 = 描述里"只属于我"的词越多 = 越容易被精确选中；低于 50% 算不清（skill-authoring 判据）')
  const rows = []
  for (const n of active) {
    const set = tok.get(n)
    let uniq = 0
    for (const t of set) if ((df.get(t) || 0) === 1) uniq++
    const ratio = set.size ? uniq / set.size : 0
    rows.push({ n, size: set.size, uniq, ratio })
  }
  rows.sort((a, b) => a.ratio - b.ratio)
  for (const r of rows.slice(0, 6)) {
    console.log(`  ${(r.ratio * 100).toFixed(1)}% 独有（${r.uniq}/${r.size}）  ${r.n}`)
  }
  const worst = rows[0]
  console.log(`  → 最低是 ${worst?.n ?? 'N/A'}（${(worst?.ratio * 100).toFixed(1)}%）`)
  const low = rows.filter((r) => r.ratio < 0.5).map((r) => `${r.n} ${(r.ratio * 100).toFixed(1)}%`)
  console.log(`  低于判据 50% 的 ${low.length} 个${low.length ? `：${low.join('、')}` : ''}`)
  console.log('  （只提示不阻断：低独有词 = 描述可再收紧，不等于该改；也受词元切分口径影响）')
  console.log('  （口径盲区：中英同义词未归一 —— "component" 与「组件」不计为重合。description 全英文时独有词会虚高；')
  console.log('    中文化后同一技能的比例会真实下降，2026-11-09 三条导入技能中文化时 vue-component 由 46.2% 降为 38.5% 即此故，别当成退化。）')
  console.log('')

  console.log('## 二、结构')
  const imported = (n) => (skills.get(n)?.rel || '').startsWith('.agents/skills/')
  const tag = (n) => (imported(n) ? '　（导入层·改动需自担重导合并成本，本轮未改）' : '')
  const long = active.filter((n) => skills.get(n).desc.length > 200)
  const en = active.filter((n) => zhRatio(skills.get(n).desc) < 0.3)
  const noZh = active.filter((n) => !/当[^。]{0,60}(?:时用|时)|触发[:：]/.test(skills.get(n).desc))
  if (long.length) {
    console.log(`- 超 200 字符（挤预算）：`)
    for (const n of long) console.log(`    ${skills.get(n).desc.length}字  ${n}${tag(n)}`)
  } else console.log('- 超 200 字符：无')
  if (en.length) {
    console.log(`- 非中文主导（中文用户输入时靠跨语种匹配，风险更高）：`)
    for (const n of en) console.log(`    中文占比 ${(zhRatio(skills.get(n).desc) * 100).toFixed(0)}%  ${n}${tag(n)}`)
  } else console.log('- 非中文主导：无')
  if (noZh.length) {
    console.log(`- 无中文触发句（「当…时用」/「触发：」）：`)
    for (const n of noZh) console.log(`    ${n}${tag(n)}`)
  } else console.log('- 无中文触发句：无')
  const importedHits = [...new Set([...long, ...en, ...noZh])].filter(imported)
  if (importedHits.length) {
    console.log(`  （其中 ${importedHits.length} 个来自 .agents/skills 导入层：本站无自动同步脚本，改动不会被上游冲掉，成本只是将来重导时自行合并 —— 未改是按收益判据，不是不能改）`)
  }
  console.log('')

  console.log('## 三、共用开头模板（同头 = 区分只能靠后半段）')
  const heads = new Map()
  for (const n of active) {
    const h = skills.get(n).desc.slice(0, 10)
    if (!heads.has(h)) heads.set(h, [])
    heads.get(h).push(n)
  }
  const dupHeads = [...heads.entries()].filter(([, v]) => v.length > 1)
  if (dupHeads.length === 0) console.log('无')
  else for (const [h, v] of dupHeads) console.log(`  "${h}…"  ${v.join(' / ')}`)
  console.log('')

  console.log('## 结论口径')
  console.log('本审计只判文本可判定项，不判"模型会不会真的触发"。')
  console.log('外部（Anthropic skill-creator / SWEStash routing benchmark）测触发都要真调模型、跑 3 次取率、按 accept-set 判分；')
  console.log('tea 不接外部模型调用，所以不在此假装测触发率。')
}

main()
