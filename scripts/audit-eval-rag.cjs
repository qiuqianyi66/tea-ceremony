#!/usr/bin/env node
/**
 * audit-eval-rag.cjs — RAG 指标口径与语料对齐审计（静态，无 DB / 无后端 / 无网络，可进 CI）
 *
 * 治的病（三个都真实发生过，见 2026-10-18 full-judge 报告与 A8 待办）：
 *   ① 指标口径与架构脱耦：`ragHitRate` 的分母是全部 50 条 case，其中 44 条按设计就不该走检索
 *      （冲泡步骤/品鉴评价/闲聊/对抗），于是「模型调没调工具」被当成「检索准不准」，
 *      0.16 这个数被当作 RAG 质量基线用了三周。
 *   ② 子集口径口径太窄：`kbDependent` 只认考点名里含「知识库命中」四个字，语义上要求
 *      「引用知识库出处」的 case（LIB-001）不算 KB 依赖 → ragRecallK 样本只有 3–4 条，
 *      统计上不可用，而报告里它是 null 也没人拦。
 *   ③ 语料与评测集脱耦：评测集声明依赖知识库的条目，种子语料里根本没有对应实体
 *      （LIB-006「茶寿」在 V2__culture_seed.sql 零覆盖），于是「检索失败」和「语料缺失」
 *      被混成同一个数字，排查方向从一开始就是错的。
 *
 * 三项检查：
 *   A 语料对齐（默认，ERROR）：KB 依赖 case 的切词关键词必须在种子语料里至少出现一次，
 *     一次都不出现 = 该 case 无论检索怎么修都不可能命中 → 必须先补语料或去掉 KB 依赖。
 *   B 标注规模（默认，WARN + 棘轮）：语义口径 KB 依赖 case 数低于 KB_FLOOR 判 ERROR（防回退），
 *     低于 KB_TARGET 打印 WARN（指标无统计意义，n 太小）。
 *   C 报告口径（`--report <json>`）：给出 ragHitRate 与 ragRecallK 的分母构成，并列出
 *     KB 依赖 case 的真 miss（ERROR，可豁免）。
 *
 * 切词逻辑复用 scripts/lib/rag-keywords.cjs（CultureSearchService.splitKeywords 的镜像）。
 *
 * 豁免：确实必须留下已知语料缺口的 case，在 RAG_ALLOW 里登记（id + 理由 ≥8 字 + 去向）。
 * 豁免是预算不是通道（与 R2 / PROBE-ALLOW 同规）：全表 ≤ RAG_ALLOW_BUDGET 条，
 * 每次运行把每条豁免打印出来，防静默腐烂。补了语料就删掉对应条目。
 *
 * 输出契约：`ERRORS: [...]` + 退出码 1；全绿 `ERRORS: []`（与 audit-redlines.cjs 同族）。
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const {
  splitKeywords,
  isKbDependent,
  isKbDependentNarrow,
  expectedMentionsKbHits,
} = require('./lib/eval-rag-rules.cjs')

const root = path.resolve(__dirname, '..')
const CASES_DIR = path.join(root, 'docs', 'ai-eval', 'cases')
const CASE_FILES = [
  'advisor.yaml',
  'taster.yaml',
  'librarian.yaml',
  'brewer.yaml',
  'mentor.yaml',
  'chat.yaml',
]
const SEED = path.join(root, 'backend', 'src', 'main', 'resources', 'db', 'migration', 'V2__culture_seed.sql')

/** 豁免预算：≤3 条，每条必须写清去向。 */
const RAG_ALLOW_BUDGET = 3
// 当前为空：茶寿（LIB-006）不是 KB 依赖 case —— 它考的是「未命中时如何优雅降级」，
// 不该被要求命中，故不进豁免表（曾被误登一条，已删）。
const RAG_ALLOW = []
const KB_FLOOR = 4 // 棘轮：低于此数说明标注被删（当前语义口径实测 4 条）
const KB_TARGET = 10 // 目标：低于此数 ragRecallK 没有统计意义
const MIN_REASON_CHARS = 8

const errors = []
const warns = []

function loadCases() {
  const cases = []
  for (const file of CASE_FILES) {
    const full = path.join(CASES_DIR, file)
    if (!fs.existsSync(full)) {
      errors.push(`缺失评测文件: ${file}`)
      continue
    }
    let doc
    try {
      doc = yaml.load(fs.readFileSync(full, 'utf8'))
    } catch (e) {
      errors.push(`${file} YAML 解析失败: ${e.message}`)
      continue
    }
    for (const c of doc?.cases || []) {
      cases.push({ file, id: c.id, input: c.input, points: c.points, expected: c.expected })
    }
  }
  return cases
}

/** 种子语料 = 全部 SQL 单引号字面量（含 JSON 载荷），去转义后拼成一坨用于子串判定。 */
function loadCorpus() {
  if (!fs.existsSync(SEED)) {
    errors.push(`缺失种子语料: ${path.relative(root, SEED)}`)
    return ''
  }
  const raw = fs.readFileSync(SEED, 'utf8')
  const literals = raw.match(/'(?:[^']|'')*'/g) || []
  return literals.map((s) => s.slice(1, -1).replace(/''/g, "'")).join('\n')
}

function checkAllowlist() {
  if (RAG_ALLOW.length > RAG_ALLOW_BUDGET) {
    errors.push(`豁免超预算：${RAG_ALLOW.length} > ${RAG_ALLOW_BUDGET}（豁免是预算不是通道）`)
  }
  for (const a of RAG_ALLOW) {
    if (!a.id || !a.reason || a.reason.length < MIN_REASON_CHARS || !a.todo) {
      errors.push(`豁免条目不合规（需 id/理由≥${MIN_REASON_CHARS} 字/去向）: ${JSON.stringify(a)}`)
    }
    console.log(`ALLOW ${a.id}: ${a.reason}（${a.todo}）`)
  }
}

function auditCorpus(cases, corpus) {
  const kb = cases.filter((c) => isKbDependent(c.points))
  const narrow = cases.filter((c) => isKbDependentNarrow(c.points))
  console.log(
    `KB 依赖 case：语义口径 ${kb.length} 条（历史窄口径 ${narrow.length} 条，差额来自「引用…出处」考点）`,
  )
  const allowIds = new Set(RAG_ALLOW.map((a) => a.id))
  for (const c of kb) {
    const kws = splitKeywords(c.input).filter((k) => k.length >= 2)
    const covered = kws.filter((k) => corpus.includes(k))
    if (covered.length === 0) {
      const msg = `语料零覆盖 ${c.id}「${String(c.input).slice(0, 24)}」关键词=[${kws.slice(0, 6).join('/')}]`
      if (allowIds.has(c.id)) console.log(`ALLOWED-GAP ${msg}`)
      else errors.push(msg)
    } else {
      console.log(`OK ${c.id} 语料可覆盖：${covered.slice(0, 4).join('/')}`)
    }
  }
  if (kb.length < KB_FLOOR) {
    errors.push(`KB 依赖 case 数 ${kb.length} < 棘轮下限 ${KB_FLOOR}（标注被删或判据失灵）`)
  } else if (kb.length < KB_TARGET) {
    warns.push(
      `KB 依赖 case 仅 ${kb.length} 条 < 目标 ${KB_TARGET}：ragRecallK 样本过小，不可作为质量结论（扩标注）`,
    )
  }
  // 漏标检查：expected 自己写着「知识库命中」，考点却没标 → 这条永远不进 ragRecallK 样本
  for (const c of cases) {
    if (isKbDependent(c.points)) continue
    if (expectedMentionsKbHits(c.expected)) {
      warns.push(
        `期望依赖但未标注 ${c.id}：expected 提到「知识库命中」，考点未标 → 不计入 ragRecallK`,
      )
    }
  }
  return kb
}

function auditReport(reportPath, kb) {
  if (!fs.existsSync(reportPath)) {
    errors.push(`报告不存在: ${reportPath}`)
    return
  }
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  } catch (e) {
    errors.push(`报告解析失败: ${e.message}`)
    return
  }
  const runs = Array.isArray(doc.runs) ? doc.runs : []
  if (runs.length === 0) {
    errors.push('报告缺 runs 数组')
    return
  }
  const num = (v) => typeof v === 'number'
  const hit = runs.filter((r) => num(r.sources) && r.sources > 0).length
  const zero = runs.filter((r) => num(r.sources) && r.sources === 0).length
  const nulls = runs.filter((r) => !num(r.sources)).length
  console.log(`\n--- 报告口径（${path.basename(reportPath)}）---`)
  console.log(
    `ragHitRate 分母构成：总计 ${runs.length}｜sources>0 ${hit}｜sources=0 ${zero}｜sources=null ${nulls}`,
  )
  console.log(`ragHitRate = ${hit}/${runs.length} = ${(hit / runs.length).toFixed(2)}（分母含不该检索的 case）`)
  const kbIds = new Set(kb.map((c) => c.id))
  const kbRuns = runs.filter((r) => kbIds.has(r.id) || r.kbDependent === true)
  if (kbRuns.length === 0) {
    errors.push('报告里找不到任何 KB 依赖 run（kbDependent 字段缺失，无法算 ragRecallK）')
  } else {
    const kbHit = kbRuns.filter((r) => num(r.sources) && r.sources > 0).length
    console.log(
      `ragRecallK = ${kbHit}/${kbRuns.length} = ${(kbHit / kbRuns.length).toFixed(2)}（该召回的召没召回）`,
    )
    const allowIds = new Set(RAG_ALLOW.map((a) => a.id))
    for (const r of kbRuns) {
      if (num(r.sources) && r.sources > 0) continue
      const msg = `KB 依赖真 miss ${r.id}（sources=${r.sources}）`
      if (allowIds.has(r.id)) console.log(`ALLOWED-GAP ${msg}`)
      else errors.push(msg)
    }
  }
  const subReport = doc.aggregate?.ragRecallK
  if (subReport === null || subReport === undefined) {
    warns.push('报告未产出 ragRecallK（B1.1 字段缺失或 case 未标注），验收不能只看 ragHitRate')
  }
}

function main() {
  const argv = process.argv.slice(2)
  const reportIdx = argv.indexOf('--report')
  const reportPath = reportIdx >= 0 ? argv[reportIdx + 1] : null

  checkAllowlist()
  const cases = loadCases()
  const corpus = loadCorpus()
  if (errors.length === 0) {
    const kb = auditCorpus(cases, corpus)
    if (reportPath) auditReport(path.resolve(root, reportPath), kb)
  }

  for (const w of warns) console.log(`WARN: ${w}`)
  console.log(`ERRORS: ${JSON.stringify(errors)}`)
  if (errors.length > 0) process.exitCode = 1
}

main()
