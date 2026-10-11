#!/usr/bin/env node
/**
 * generate-relations.mjs — 从 src/data 生成 tea_relations 回填迁移（PLAN-ai-capability T06）。
 *
 * 用法：node scripts/generate-relations.mjs [--write]
 *  - 默认 dry-run：打印统计 + 抽检样例
 *  - --write：写入 V7__tea_relations_seed.sql（Flyway 真身）+ .harness/changes/phase2-knowledge 三件套
 *
 * 关系推导（全部来自现有数据，不编造）：
 *  1. 茶→产区「产于」：teas.origin 前缀含省简称（teas.ts origin ↔ tea-regions.ts province，与 V2 一致）
 *  2. 茶→工艺「工艺」：teas.type（六大茶类）↔ TEA_PROCESSES.teaType 直接匹配
 *  3. 人物→茶「相关人物」：TEA_MASTERS.relatedTeas（slug）→ teas.ts id（slug）→ DB id
 * 零 schema 改动：slug→DB id 映射在生成期完成（teas/people 表 id 与 ts 数组序一一对应，seed-extract.mjs 约定）。
 * 生成后须抽检（--write 会打印随机 5 条对照），勿盲信。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = (f) => join(ROOT, 'src', 'data', f)
const WRITE = process.argv.includes('--write')

// ---------- 数组字面量提取（与 seed-extract.mjs 同款；内联复制保持该脚本独立可复现） ----------
function extractArray(text, varName) {
  const re = new RegExp(`export const ${varName}[^=]*=\\s*\\[`)
  const m = re.exec(text)
  if (!m) throw new Error(`未找到数组导出: ${varName}`)
  const start = m.index + m[0].length - 1
  let depth = 0
  let inStr = null
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue }
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  throw new Error(`数组未闭合: ${varName}`)
}

function buildSandbox(src) {
  const sb = {
    TeaType: { GREEN: '绿茶', WHITE: '白茶', YELLOW: '黄茶', OOLONG: '青茶', RED: '红茶', DARK: '黑茶' },
    TeaWareType: { GAIWAN: '盖碗', YIXING: '紫砂壶', GLASS: '玻璃杯' },
  }
  const importLines = src.match(/^import .*$/gm) || []
  for (const line of importLines) {
    const names = [...line.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((x) => x[1]).filter((n) => !['import', 'from', 'type'].includes(n))
    for (const n of names) if (!(n in sb)) sb[n] = null
  }
  return sb
}

function loadArray(file, varName) {
  const src = readFileSync(file, 'utf8')
  const arrText = extractArray(src, varName)
  return vm.runInNewContext(`(${arrText})`, buildSandbox(src))
}

// ---------- 加载数据（与 V2 seed-extract 同一数据源） ----------
const teas = loadArray(DATA('teas.ts'), 'teas')
const teaRegions = loadArray(DATA('tea-regions.ts'), 'teaRegions')
const processes = loadArray(DATA('teaProcesses.ts'), 'TEA_PROCESSES')
const masters = loadArray(DATA('teaMasters.ts'), 'TEA_MASTERS')

// ---------- 映射 ----------
const slugToTeaIdx = new Map(teas.map((t, i) => [t.id, i])) // slug → teas 数组下标（DB id = idx+1）
const slugToTeaName = new Map(teas.map((t) => [t.id, t.name]))

/** 省简称（'广西壮族自治区' → 去'自治区'→'广西壮族' → 去'壮族'→'广西'；'台湾省' → '台湾'）。 */
function provinceShort(p) {
  return String(p)
    .replace(/省|自治区|特别行政区$/u, '')
    .replace(/壮族|回族|维吾尔族|藏族|蒙古族$/u, '')
}
const regionIdxByName = new Map(teaRegions.map((r, i) => [r.province, i]))
const processIdxByType = new Map(processes.map((p, i) => [p.teaType, i]))

// ---------- 关系构建 ----------
const rows = [] // {source_type, source_id, target_type, target_id, relation}

// 1. 茶→产区「产于」：origin 前缀含省简称
let unmatchedRegion = 0
const unmatchedRegionTeas = []
for (const [idx, t] of teas.entries()) {
  const origin = t.origin || ''
  let hit = null
  for (const [province, ridx] of regionIdxByName) {
    const short = provinceShort(province)
    if (short && origin.startsWith(short)) { hit = ridx; break }
  }
  if (hit === null) { unmatchedRegion++; unmatchedRegionTeas.push(`${t.name}(${origin})`); continue }
  rows.push({ source_type: 'tea', source_id: idx + 1, target_type: 'region', target_id: hit + 1, relation: '产于' })
}

// 2. 茶→工艺「工艺」：type ↔ teaType
let unmatchedProcess = 0
for (const [idx, t] of teas.entries()) {
  const pidx = processIdxByType.get(t.type)
  if (pidx === undefined) { unmatchedProcess++; continue }
  rows.push({ source_type: 'tea', source_id: idx + 1, target_type: 'process', target_id: pidx + 1, relation: '工艺' })
}

// 3. 人物→茶「相关人物」：relatedTeas slug → tea DB id
let unmatchedPersonTea = 0
for (const [pidx, m] of masters.entries()) {
  for (const slug of m.relatedTeas || []) {
    const tidx = slugToTeaIdx.get(slug)
    if (tidx === undefined) { unmatchedPersonTea++; continue }
    rows.push({ source_type: 'person', source_id: pidx + 1, target_type: 'tea', target_id: tidx + 1, relation: '相关人物' })
  }
}

// ---------- SQL 生成 ----------
const esc = (s) => String(s).replace(/'/g, "''")
function ins(table, cols, list) {
  if (!list.length) return ''
  const colSql = cols.join(', ')
  const vals = list
    .map((r) => `(${cols.map((c) => (r[c] === null || r[c] === undefined ? 'NULL' : `'${esc(r[c])}'`)).join(', ')})`)
    .join(',\n    ')
  return `INSERT INTO ${table} (${colSql}) VALUES\n    ${vals};\n`
}

const HEADER = `-- m1-tea V7 tea_relations 回填种子迁移（up，PLAN-ai-capability T06）
-- 来源：src/data/（teas 66 / tea-regions 19 / teaProcesses 6 / teaMasters 21），与 V2 seed-extract 同数据源
-- 生成：scripts/generate-relations.mjs（可复现；勿手改本文件，改数据源后重跑）
-- 关系：茶→产区（origin 省前缀）/ 茶→工艺（六大茶类）/ 人物→茶（relatedTeas slug→DB id，生成期映射，零 schema 改动）
-- 幂等说明：tea_relations 无唯一约束（V1），本迁移仅执行一次（Flyway 版本化）；重复部署需先清表（rollback.sql）
`

const upSql = HEADER + ins('tea_relations', ['source_type', 'source_id', 'target_type', 'target_id', 'relation'], rows)

const rollbackSql = `-- m1-tea V7 回滚（down）：清空 V7 回填的关系（V7 前 tea_relations 为空表）
DELETE FROM tea_relations;
ALTER TABLE tea_relations ALTER COLUMN id RESTART WITH 1;
`

// ---------- 输出 ----------
const byRelation = {}
for (const r of rows) byRelation[r.relation] = (byRelation[r.relation] || 0) + 1
console.log('=== generate-relations.mjs 统计 ===')
console.log(`  茶→产区「产于」: ${byRelation['产于'] || 0}（未匹配 ${unmatchedRegion}）`)
if (unmatchedRegionTeas.length) console.log(`    未匹配: ${unmatchedRegionTeas.join('；')}`)
console.log(`  茶→工艺「工艺」: ${byRelation['工艺'] || 0}（未匹配 ${unmatchedProcess}）`)
console.log(`  人物→茶「相关人物」: ${byRelation['相关人物'] || 0}（未匹配 slug ${unmatchedPersonTea}）`)
console.log(`  合计: ${rows.length} 条`)

if (WRITE) {
  const migrationDir = join(ROOT, 'backend', 'src', 'main', 'resources', 'db', 'migration')
  const changesDir = join(ROOT, '.harness', 'changes', 'phase2-knowledge')
  mkdirSync(changesDir, { recursive: true })
  writeFileSync(join(migrationDir, 'V7__tea_relations_seed.sql'), upSql, 'utf8')
  writeFileSync(join(changesDir, 'db-migrations.sql'), upSql, 'utf8')
  writeFileSync(join(changesDir, 'rollback.sql'), rollbackSql, 'utf8')
  console.log('\n已写入:')
  console.log('  backend/src/main/resources/db/migration/V7__tea_relations_seed.sql')
  console.log('  .harness/changes/phase2-knowledge/db-migrations.sql')
  console.log('  .harness/changes/phase2-knowledge/rollback.sql')
}

// 抽检：随机 5 条对照（slug→中文名）
const sample = rows.sort(() => Math.random() - 0.5).slice(0, 5)
console.log('\n=== 抽检（随机 5 条）===')
for (const r of sample) {
  const s = r.source_type === 'tea' ? teas[r.source_id - 1]?.name : masters[r.source_id - 1]?.name
  const t = r.target_type === 'tea' ? teas[r.target_id - 1]?.name
    : r.target_type === 'region' ? teaRegions[r.target_id - 1]?.province
    : processes[r.target_id - 1]?.name
  console.log(`  ${r.source_type}#${r.source_id} ${s} —${r.relation}→ ${r.target_type}#${r.target_id} ${t}`)
}
