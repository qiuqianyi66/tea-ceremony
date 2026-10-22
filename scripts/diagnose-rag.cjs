#!/usr/bin/env node
/**
 * RAG 命中率诊断（PLAN-open-items A8 步骤①②的机械化）。
 *
 * 背景：ragHitRate 0.16（default 0.28 / expert 0.09，2026-10-18 full-judge）是当前 AI 质量
 * 最大可量化短板。本脚本把「猜根因」变成两步实测：
 *   模式 A（--db） ：culture_chunks 覆盖统计 + 8 张文化表行数 → 定性 H1（向量通道到底能不能跑）
 *   模式 B（--api）：50 条评测问题逐条打检索端点 → 产出未命中清单，供人工标注「应有知识点」→ 定性 H2/H3
 *
 * 用法：
 *   node scripts/diagnose-rag.cjs --db            # 需本地 PG（TEA_PG）+ python（TEA_PY，需 sqlalchemy+psycopg2）
 *   node scripts/diagnose-rag.cjs --api           # 需后端运行（TEA_API_BASE，默认 http://127.0.0.1:18080）
 *   node scripts/diagnose-rag.cjs                 # 两个模式都跑
 *
 * 前置与口径：
 *   - 模式 B 打的是 GET /api/v1/culture/search（前端 fetchRAGContext 同一端点），
 *     「命中」= 返回 8 个列表中任一非空；这与评测器 ragHitRate 的 sources 口径一致但更直接。
 *   - 本脚本只测量与罗列，不下结论；根因判定按 A8 的 H1/H2/H3 假设表人工完成。
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')
const PG = process.env.TEA_PG || 'postgresql://tea_user:<本地开发口令>@localhost:5432/tea_ceremony'
const PY = process.env.TEA_PY || 'backend/.venv/Scripts/python.exe'
const API_BASE = (process.env.TEA_API_BASE || 'http://127.0.0.1:18080').replace(/\/$/, '')

function section(title) {
  console.log(`\n=== ${title} ===`)
}

// ---- 模式 A：DB 侧覆盖统计 ----
function runDb() {
  section('模式 A：culture_chunks 覆盖统计（H1：向量通道能不能跑）')
  const sql = `
SELECT count(*) AS total,
       count(*) FILTER (WHERE status = 'ready') AS ready,
       count(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding,
       count(*) FILTER (WHERE status = 'ready' AND embedding IS NOT NULL) AS usable
FROM culture_chunks;
SELECT source_type, count(*) AS n FROM culture_chunks GROUP BY source_type ORDER BY n DESC;
SELECT 'teas' AS t, count(*) AS n FROM teas
UNION ALL SELECT 'tea_people', count(*) FROM tea_people
UNION ALL SELECT 'tea_regions', count(*) FROM tea_regions
UNION ALL SELECT 'tea_poems', count(*) FROM tea_poems
UNION ALL SELECT 'teawares', count(*) FROM teawares
UNION ALL SELECT 'tea_etiquettes', count(*) FROM tea_etiquettes
UNION ALL SELECT 'tea_relations', count(*) FROM tea_relations
UNION ALL SELECT 'tea_processes', count(*) FROM tea_processes;
`
  const script = `from sqlalchemy import create_engine, text
e = create_engine(${JSON.stringify(PG)})
with e.connect() as c:
    for i, stmt in enumerate(${JSON.stringify(sql)}.split(';')):
        if not stmt.strip():
            continue
        rows = [dict(r._mapping) for r in c.execute(text(stmt))]
        print('@@@', i, rows)
`
  const tmp = path.join(ROOT, 'backend/_ragdiag.py')
  fs.writeFileSync(tmp, script)
  let out
  try {
    out = execSync(`cd backend && "${PY}" _ragdiag.py`, { encoding: 'utf8' })
  } catch (e) {
    console.log('DB 查询失败：', e.message.split('\n')[0])
    console.log('检查：PG 是否运行；TEA_PY 指向的 python 是否装了 sqlalchemy + psycopg2')
    fs.unlinkSync(tmp)
    process.exitCode = 1
    return
  }
  fs.unlinkSync(tmp)
  for (const line of out.split('\n')) {
    if (!line.startsWith('@@@')) continue
    const rows = eval(line.slice(4).trim())
    console.table(rows)
  }
  console.log('判读：usable = 0 → H1 成立（向量通道整体不可用，先查 backfill 与 EmbeddingModel 装配）；')
  console.log('      usable > 0 但命中仍低 → H1 排除，转模式 B + 阈值/补缺策略（H2）与语料覆盖（H3）。')
}

// ---- 模式 B：评测问题逐条打检索端点 ----
function loadCases() {
  const dir = path.join(ROOT, 'docs/ai-eval/cases')
  const cases = []
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()) {
    const doc = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8'))
    for (const c of doc.cases || []) cases.push({ file: f, id: c.id, input: c.input })
  }
  return cases
}

async function runApi() {
  section('模式 B：评测集 50 条逐条检索命中（H2/H3 素材）')
  const cases = loadCases()
  const misses = []
  const byFile = {}
  for (const c of cases) {
    let hit = false
    let err = null
    try {
      const res = await fetch(`${API_BASE}/api/v1/culture/search?q=${encodeURIComponent(c.input)}`)
      const body = await res.json()
      const data = body.data || {}
      hit = Object.values(data).some((v) => Array.isArray(v) && v.length > 0)
    } catch (e) {
      err = e.message
    }
    const stat = (byFile[c.file] ||= { total: 0, hit: 0 })
    stat.total++
    if (hit) stat.hit++
    else misses.push(err ? { ...c, err } : c)
  }
  for (const [f, s] of Object.entries(byFile)) {
    console.log(`${f}\t${s.hit}/${s.total}\t${((s.hit / s.total) * 100).toFixed(0)}%`)
  }
  const totalHit = Object.values(byFile).reduce((a, s) => a + s.hit, 0)
  const errCount = misses.filter((m) => m.err).length
  console.log(`合计：${totalHit}/${cases.length}（${((totalHit / cases.length) * 100).toFixed(0)}%）`)
  if (errCount === cases.length) {
    console.log(`\n全部请求失败——后端不可达（${API_BASE}）。先起后端（docker compose up -d backend，宿主 127.0.0.1:18080），或用 TEA_API_BASE 指定地址。`)
    process.exitCode = 1
    return
  }
  console.log(`\n未命中 ${misses.length} 条（供人工标注「应有知识点」→ 定性 H2 阈值/补缺 or H3 语料覆盖）：`)
  for (const m of misses) console.log(`  ${m.id}\t${m.input}${m.err ? `\t[请求失败: ${m.err}]` : ''}`)
  if (errCount > 0) console.log(`（其中 ${errCount} 条为请求失败，非检索未命中）`)
}

const args = process.argv.slice(2)
;(async () => {
  if (args.includes('--db') || args.length === 0) runDb()
  if (args.includes('--api') || args.length === 0) await runApi()
})()
