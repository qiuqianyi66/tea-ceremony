#!/usr/bin/env node
/**
 * 仓库地图生成（T14/K13）：扫描前端 src/ 与后端 backend/src/main/java，输出 docs/reference/repo-map.md（≤300 行）。
 * 抽查关键符号：缺失任一 → exit 1（防 map 与代码漂移）。
 * 用法：node scripts/gen-repomap.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'reference', 'repo-map.md')
const SCAN_ROOTS = [
  ['src', path.join(ROOT, 'src')],
  ['backend/src/main/java', path.join(ROOT, 'backend', 'src', 'main', 'java')],
  ['scripts', path.join(ROOT, 'scripts')],
  ['docs', path.join(ROOT, 'docs')],
]
const SKIP = new Set(['node_modules', 'dist', '.git', 'target', '.venv', '__pycache__', '.tmp', 'ai-eval', '.harness', '.claude'])
const MAX_TREE_LINES = 250

// 抽查符号（关键词命中路径即算命中）——真实存在，缺失表示 map 扫描有洞
const SYMBOLS = [
  ['src/services/teaAI.ts', 'teaAI'],
  ['src/data/teaProcesses.ts', 'teaProcesses'],
  ['src/stores', 'stores'],
  ['src/components/three', 'components/three'],
  ['后端 AiChatService', 'ai/service/AiChatService'],
  ['后端 LibrarianAgent', 'ai/agent/LibrarianAgent'],
  ['后端 RateLimitFilter', 'common/ratelimit/RateLimitFilter'],
  ['活文档 TODO-PRIORITY', 'plans/TODO-PRIORITY'],
]

/** 收集文件相对路径（过滤 SKIP 目录），dir 相对 ROOT 显示。 */
function collect(rootRel, rootAbs) {
  const out = []
  const walk = (rel, abs, depth) => {
    if (depth > 6) return
    let entries
    try { entries = fs.readdirSync(abs, { withFileTypes: true }) } catch { return }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      const childAbs = path.join(abs, e.name)
      if (e.isDirectory()) {
        out.push({ path: childRel, dir: true })
        walk(childRel, childAbs, depth + 1)
      } else {
        out.push({ path: childRel, dir: false })
      }
    }
  }
  walk(rootRel, rootAbs, 0)
  return out
}

// ---- 收集 ----
const all = []
for (const [rel, abs] of SCAN_ROOTS) {
  if (fs.existsSync(abs)) all.push(...collect(rel, abs))
}
const filePaths = all.filter((f) => !f.dir).map((f) => f.path)

// ---- 抽查 ----
const missing = SYMBOLS.filter(([label, kw]) => !filePaths.some((p) => p.includes(kw)))

// ---- 生成 markdown（≤300 行）----
const treeLines = []
for (const f of all.slice(0, MAX_TREE_LINES)) {
  const indent = '  '.repeat(f.path.split('/').length - 1)
  treeLines.push(`${indent}${f.dir ? '' : '📄 '}${f.path.split('/').pop()}${f.dir ? '/' : ''}`)
}
const truncated = all.length > MAX_TREE_LINES ? `（目录条目 ${all.length} 个，仅展示前 ${MAX_TREE_LINES} 行）` : ''

const md = `---
title: repo-map
last_updated: ${new Date().toISOString().slice(0, 10)}
---

# 一盏茶 仓库地图（自动生成）

> 由 \`node scripts/gen-repomap.cjs\` 生成，勿手改。抽查符号缺失会 exit 1（防漂移）。
> 范围：src / backend/src/main/java / scripts / docs（跳过 node_modules/dist/target/.git 等）。

## 目录树

\`\`\`
${treeLines.join('\n')}
\`\`\`
${truncated}

## 关键符号抽查（${SYMBOLS.length - missing.length}/${SYMBOLS.length} 命中）

${SYMBOLS.map(([label, kw]) => `- ${missing.some((m) => m[1] === kw) ? '❌ 缺失' : '✅ 命中'} ${label}`).join('\n')}
${missing.length > 0 ? `\n> 缺失项：${missing.map((m) => m[0]).join(' / ')} —— 扫描有洞或符号已删除，需修复。` : ''}
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md, 'utf8')

console.log(`repo-map: ${all.length} 条目 → ${path.relative(ROOT, OUT)}（${treeLines.length} 行树）`)
console.log(`抽查: ${SYMBOLS.length - missing.length}/${SYMBOLS.length} 命中`)
if (missing.length > 0) {
  console.error(`缺失: ${missing.map((m) => m[0]).join(' / ')}`)
  process.exit(1)
}
console.log('OK')
