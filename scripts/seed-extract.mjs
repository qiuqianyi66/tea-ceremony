#!/usr/bin/env node
/**
 * seed-extract.mjs — 从 src/data/ TS 数据文件提取种子数据，生成 Flyway V2 迁移 SQL。
 *
 * 用法：node scripts/seed-extract.mjs [--write]
 *  - 默认 dry-run：打印各表条数统计
 *  - --write：写入 V2__culture_seed.sql（Flyway 真身）+ changes 三件套留档
 *
 * 依据（只读核实，不编造）：
 *  - src/data/teas.ts 66 茶（键：name/type/origin/altitude/process/bestTemp/bestTime/infusions/flavor/story/description/dryTeaColor/soupColorMin/soupColorMax/image）
 *  - src/data/tea-regions.ts 19 省级产区（province/zone/climate/famousTeas/culture）
 *  - src/data/teaProcesses.ts 6 工艺（teaType/name/summary/steps）
 *  - src/data/teaMasters.ts 21 茶人（name/dynasty/title/avatar/description/contribution/quote/relatedTeas）
 *  - src/data/teaPoems.ts 25 茶诗（title/author/dynasty/content/relatedTeaIds?/description）
 *  - src/data/teawares.ts 6 茶器（name/type/capacity/material/description/story/bonus/recommended/rarity）
 *  - src/data/teaEtiquette.ts 14 茶礼（name/occasion/description/steps）
 *  - 枚举：src/types/tea.ts（TeaType=绿茶/白茶/黄茶/青茶/红茶/黑茶）、src/types/teaware.ts（TeaWareType=盖碗/紫砂壶/玻璃杯）
 *
 * 映射决策（与 PLAN.md T7 方案一致）：
 *  - teas.region_id/process_id/season/grade/historical_period/water_requirement 留 NULL（旧库 seeds 亦无关联，不编造）
 *  - related_tea_ids 存 src/data 的 tea slug 数组（不映射数字 id）
 *  - tea_regions.name = province（省级茶产区，表语义可接受；famous_for 存 FamousTea[]）
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = (f) => join(ROOT, 'src', 'data', f)
const WRITE = process.argv.includes('--write')

// ---------- 数组字面量提取（跳过字符串内的括号） ----------
function extractArray(text, varName) {
  const re = new RegExp(`export const ${varName}[^=]*=\\s*\\[`)
  const m = re.exec(text)
  if (!m) throw new Error(`未找到数组导出: ${varName}`)
  const start = m.index + m[0].length - 1 // '[' 位置
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

// ---------- SQL 生成 ----------
const esc = (s) => String(s).replace(/'/g, "''")
function sqlVal(v) {
  if (v === undefined || v === null) return 'NULL'
  if (typeof v === 'string') return `'${esc(v)}'`
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v) || typeof v === 'object') return `'${esc(JSON.stringify(v))}'::jsonb`
  return 'NULL'
}
function ins(table, cols, rows) {
  if (!rows.length) return ''
  const colSql = cols.join(', ')
  const vals = rows
    .map((r) => `(${cols.map((c) => sqlVal(r[c])).join(', ')})`)
    .join(',\n    ')
  return `INSERT INTO ${table} (${colSql}) VALUES\n    ${vals};\n`
}

// ---------- 加载数据 ----------
const teas = loadArray(DATA('teas.ts'), 'teas')
const teaRegions = loadArray(DATA('tea-regions.ts'), 'teaRegions')
const processes = loadArray(DATA('teaProcesses.ts'), 'TEA_PROCESSES')
const masters = loadArray(DATA('teaMasters.ts'), 'TEA_MASTERS')
const poems = loadArray(DATA('teaPoems.ts'), 'TEA_POEMS')
const wares = loadArray(DATA('teawares.ts'), 'teawares')
const etiquettes = loadArray(DATA('teaEtiquette.ts'), 'TEA_ETIQUETTES')

// ---------- 映射 ----------
const regionRows = teaRegions.map((r) => ({
  name: r.province,
  province: r.province,
  climate: r.climate ?? null,
  famous_for: r.famousTeas ?? [],
  description: r.culture ?? null,
}))
const processRows = processes.map((p) => ({
  tea_category: p.teaType,
  name: p.name ?? null,
  summary: p.summary ?? null,
  steps: p.steps ?? [],
}))
const teaRows = teas.map((t) => ({
  name: t.name,
  category: t.type,
  origin: t.origin ?? null,
  altitude: t.altitude ?? null,
  best_temp: t.bestTemp ?? null,
  best_time: t.bestTime ?? null,
  infusions: t.infusions ?? 3,
  flavor: t.flavor ?? [],
  story: t.story ?? null,
  description: t.description ?? null,
  soup_color_min: t.soupColorMin ?? null,
  soup_color_max: t.soupColorMax ?? null,
  dry_tea_color: t.dryTeaColor ?? null,
}))
const peopleRows = masters.map((m) => ({
  name: m.name,
  dynasty: m.dynasty ?? null,
  title: m.title ?? null,
  avatar: m.avatar ?? null,
  description: m.description ?? null,
  contribution: m.contribution ?? null,
  quote: m.quote ?? null,
  related_tea_ids: m.relatedTeas ?? [],
}))
const poemRows = poems.map((p) => ({
  title: p.title ?? null,
  author: p.author ?? null,
  dynasty: p.dynasty ?? null,
  content: p.content ?? null,
  related_tea_ids: p.relatedTeaIds ?? [],
  description: p.description ?? null,
}))
const wareRows = wares.map((w) => ({
  name: w.name,
  ware_type: w.type ?? null,
  material: w.material ?? null,
  capacity: w.capacity ?? null,
  description: w.description ?? null,
  culture_story: w.story ?? null,
  bonus: w.bonus ?? {},
  recommended: w.recommended ?? [],
  rarity: w.rarity ?? 'common',
}))
const etRows = etiquettes.map((e) => ({
  name: e.name,
  occasion: e.occasion ?? null,
  description: e.description ?? null,
  steps: e.steps ?? [],
}))

const stats = {
  tea_regions: regionRows.length,
  tea_processes: processRows.length,
  teas: teaRows.length,
  tea_people: peopleRows.length,
  tea_poems: poemRows.length,
  teawares: wareRows.length,
  tea_etiquettes: etRows.length,
}

// ---------- 输出 SQL ----------
const HEADER = `-- m1-tea V2 文化数据种子迁移（up）
-- 来源：src/data/（teas 66 / tea-regions 19 / teaProcesses 6 / teaMasters 21 / teaPoems 25 / teawares 6 / teaEtiquette 14）
-- 生成：scripts/seed-extract.mjs（可复现；勿手改本文件，改数据源后重跑）
-- 映射决策：region_id/process_id 留 NULL（旧库 seeds 亦无关联）；related_tea_ids 存 src/data tea slug 数组；
--           tea_regions.name=province（省级产区），famous_for 存 FamousTea[]；teas.tea_relations 无数据源留空
`

const upSql =
  HEADER +
  ins('tea_regions', ['name', 'province', 'climate', 'famous_for', 'description'], regionRows) +
  ins('tea_processes', ['tea_category', 'name', 'summary', 'steps'], processRows) +
  ins('teas', ['name', 'category', 'origin', 'altitude', 'best_temp', 'best_time', 'infusions', 'flavor', 'story', 'description', 'soup_color_min', 'soup_color_max', 'dry_tea_color'], teaRows) +
  ins('tea_people', ['name', 'dynasty', 'title', 'avatar', 'description', 'contribution', 'quote', 'related_tea_ids'], peopleRows) +
  ins('tea_poems', ['title', 'author', 'dynasty', 'content', 'related_tea_ids', 'description'], poemRows) +
  ins('teawares', ['name', 'ware_type', 'material', 'capacity', 'description', 'culture_story', 'bonus', 'recommended', 'rarity'], wareRows) +
  ins('tea_etiquettes', ['name', 'occasion', 'description', 'steps'], etRows)

const rollbackSql = `-- m1-tea V2 回滚（down）：删除种子数据 + 重置 identity 序列
-- 逆序删除（FK 依赖：teas→regions/processes；tasting_records→teas/teawares，当前无数据）
DELETE FROM teawares;
DELETE FROM tea_etiquettes;
DELETE FROM tea_poems;
DELETE FROM tea_people;
DELETE FROM teas;
DELETE FROM tea_processes;
DELETE FROM tea_regions;
ALTER TABLE tea_regions ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_processes ALTER COLUMN id RESTART WITH 1;
ALTER TABLE teas ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_people ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_poems ALTER COLUMN id RESTART WITH 1;
ALTER TABLE teawares ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_etiquettes ALTER COLUMN id RESTART WITH 1;
`

console.log('=== seed-extract.mjs 统计 ===')
for (const [t, n] of Object.entries(stats)) console.log(`  ${t}: ${n}`)
console.log('  合计:', Object.values(stats).reduce((a, b) => a + b, 0), '条')

if (WRITE) {
  const migrationDir = join(ROOT, 'backend', 'src', 'main', 'resources', 'db', 'migration')
  const changesDir = join(ROOT, '.harness', 'changes', 'm1-tea')
  mkdirSync(changesDir, { recursive: true })
  writeFileSync(join(migrationDir, 'V2__culture_seed.sql'), upSql, 'utf8')
  writeFileSync(join(changesDir, 'db-migrations.sql'), upSql, 'utf8')
  writeFileSync(join(changesDir, 'rollback.sql'), rollbackSql, 'utf8')
  console.log('\n已写入:')
  console.log('  backend/src/main/resources/db/migration/V2__culture_seed.sql')
  console.log('  .harness/changes/m1-tea/db-migrations.sql')
  console.log('  .harness/changes/m1-tea/rollback.sql')
}
