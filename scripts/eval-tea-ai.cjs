#!/usr/bin/env node
/**
 * 一盏茶 AI 评测器（T11，F-A3/F-A4/F-A5/F-A6）。
 * 用法：
 *   node scripts/eval-tea-ai.cjs                      # 全量，1 次迭代（不跑 judge）
 *   node scripts/eval-tea-ai.cjs --iterations 3       # pass^3 正式跑
 *   node scripts/eval-tea-ai.cjs --judge              # 启用 LLM-as-Judge（调 /api/v1/ai/chat agent=mentor）
 *   node scripts/eval-tea-ai.cjs --file librarian.yaml --subset 2   # 单文件前 N 条
 *   node scripts/eval-tea-ai.cjs --dry-run            # 不调 API，验证管道（mock 响应）
 *   node scripts/eval-tea-ai.cjs --delay 13000        # 覆盖条间隔（默认 6500ms）
 * 依赖：后端容器 tea-backend-1（18080）；AI key 在 .env（AI_DASHSCOPE_API_KEY），承重墙 502 降级可测。
 * 注意：AI 面限流 10/min（tea.ratelimit.ai-max=10，T04 引入）——评测按真实用户节奏跑，默认每条间隔 6.5s；--judge 时每条 2 次调用，建议 --delay 13000。
 * 判分核心在 scripts/eval-core.cjs（纯函数，node --test 单测）。
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { scoreCase, scoreCaseProgramOnly, passK, aggregate, round, parseJudgeVerdict, evalPointProgram } = require('./eval-core.cjs')

const ROOT = path.join(__dirname, '..')
const CASES_DIR = path.join(ROOT, 'docs', 'ai-eval', 'cases')
const REPORTS_DIR = path.join(ROOT, 'docs', 'ai-eval', 'reports')
const FILES = ['advisor.yaml', 'taster.yaml', 'librarian.yaml', 'brewer.yaml', 'mentor.yaml', 'chat.yaml']

// ---- program 判分基准（来源：src/data/teas.ts + constants.ts，2026-10-10 v4 修正）----
const CATEGORY_EXPECT = {
  'LIB-001': ['乌龙茶'], 'LIB-005': ['黄茶'], 'ADV-001': ['乌龙茶', '绿茶', '白茶'],
  'ADV-002': ['红茶', '黑茶'], 'ADV-004': ['岩茶', '普洱', '滇红'],
  'BRE-001': ['乌龙茶'], 'BRE-003': ['黑茶'], 'BRE-004': ['白茶'],
}
// F3 茶名→茶类映射（基准 = src/data/teas.ts 的 TeaType 实际值，禁止凭记忆写）
const TEA_NAME_CATEGORY = {
  碧螺春: '绿茶', 龙井: '绿茶', 西湖龙井: '绿茶', 毛峰: '绿茶', 莫干黄芽: '黄茶',
  铁观音: '青茶', 凤凰单丛: '青茶', 武夷岩茶: '青茶', 大红袍: '青茶', 水仙: '青茶', 肉桂: '青茶',
  正山小种: '红茶', 金骏眉: '红茶', 滇红: '红茶',
  白毫银针: '白茶', 寿眉: '白茶', 贡眉: '白茶',
  熟普洱: '黑茶', 普洱: '黑茶', 六堡: '黑茶',
  君山银针: '黄茶',
}
const TEMP_EXPECT = {
  'BRE-001': { min: 90, max: 100 }, 'BRE-002': { min: 80, max: 85 },
  'BRE-003': { min: 95, max: 100 }, 'BRE-004': { min: 85, max: 90 },
}
const REFUSAL_KEYWORDS = ['拒绝', '不能', '无法', '不支持', '抱歉', '无法提供', '不教', '不建议', '不宜', '请勿', '安全']
// F2 六境基准必须对齐产品实际值（src/data/constants.ts TEA_LEVELS）：识茶/知器/懂水/悟香/品境/茶心
// 原文案「行茶/见性/归真」在产品数据中不存在，属判分基准错误（2026-10-10 实测）。
const SIX_LEVEL_KEYWORDS = ['识茶', '知器', '懂水', '悟香', '品境', '茶心']

const args = process.argv.slice(2)
const opt = {
  baseUrl: argVal(args, '--base-url', 'http://localhost:18080'),
  iterations: parseInt(argVal(args, '--iterations', '1'), 10),
  judge: args.includes('--judge'),
  dryRun: args.includes('--dry-run'),
  file: argVal(args, '--file', null),
  subset: parseInt(argVal(args, '--subset', '0'), 10),
  delayMs: parseInt(argVal(args, '--delay', '6500'), 10),
}

main().catch((e) => { console.error(e); process.exit(1) })

async function main() {
  const cases = loadCases(opt.file)
  const runs = []
  const failures = []
  for (const [file, caseDef] of cases) {
    if (opt.subset > 0 && runs.length >= opt.subset) break
    // 限流保护（10/min，T04）：非 dry-run 且非首条时按产品节奏等待
    if (!opt.dryRun && runs.length > 0) await new Promise((r) => setTimeout(r, opt.delayMs))
    const results = []
    for (let i = 0; i < opt.iterations; i++) {
      const result = opt.dryRun ? mockResult(caseDef) : await callChat(opt, file, caseDef.input)
      const meta = { ...result, expectedCategory: CATEGORY_EXPECT[caseDef.id], expectedTemp: TEMP_EXPECT[caseDef.id], refusalKeywords: REFUSAL_KEYWORDS, sixLevelKeywords: SIX_LEVEL_KEYWORDS, teaNameCategory: TEA_NAME_CATEGORY }
      if (opt.judge) meta.judgeScores = await judgeCase(opt, caseDef, result)
      results.push(meta)
    }
    const scores = results.map((r) => scoreCase(caseDef, r))
    const pk = passK(scores, opt.iterations)
    const last = results[results.length - 1] ?? {}
    // F-2 口径字段：program-only 分（judge off 时的真实可比口径）+ judge 覆盖率计数
    const programOnlyScore = scoreCaseProgramOnly(caseDef, last)
    const judgePointCount = (caseDef.points || []).filter((p) => p.check === 'judge').length
    const judgeFilledCount = (caseDef.points || []).filter((p) => {
      if (p.check !== 'judge') return false
      const v = last.judgeScores && last.judgeScores[p.name]
      return v === 1 || v === 0 // UNKNOWN / 未回填不算已判
    }).length
    // F1 逐考点明细（v4）：无观测则无法归因——旧版只存 80 字符 snippet，归因只能靠猜。
    const pointDetail = explainPoints(caseDef, last)
    const run = { id: caseDef.id, file, type: caseDef.type, input: caseDef.input.slice(0, 60), score: round(scores[0] ?? 0), programOnlyScore: programOnlyScore === null ? null : round(programOnlyScore), judgePointCount, judgeFilledCount, passResult: pk, httpStatus: last.httpStatus, contentSnippet: (last.content || '').slice(0, 80), sources: Array.isArray(last.sources) ? last.sources.length : null, tokensIn: last.tokensIn ?? null, tokensOut: last.tokensOut ?? null, latencyMs: last.latencyMs ?? null, points: pointDetail }
    runs.push(run)
    if (run.score < 1) failures.push({ id: caseDef.id, type: caseDef.type, score: run.score, input: caseDef.input, httpStatus: run.httpStatus, contentSnippet: run.contentSnippet, sources: run.sources, points: pointDetail })
  }

  const report = {
    date: new Date().toISOString().slice(0, 10),
    config: { iterations: opt.iterations, judge: opt.judge, dryRun: opt.dryRun },
    cases: runs.length,
    aggregate: aggregate(runs, opt.iterations),
    runs,
    failures,
  }
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  const out = path.join(REPORTS_DIR, `${report.date}${opt.dryRun ? '-dry' : ''}.json`)
  fs.writeFileSync(out, JSON.stringify(report, null, 2))
  printSummary(report)
}

// ---- IO（原生 fetch，Node 18+；禁止同步 busy-wait——会饿死事件循环）----

/**
 * F1 逐考点判分明细（v4）：把每个考点的得分与判分依据落盘。
 * 旧版只存 80 字符 snippet，导致归因只能靠猜（且猜错过三次）。
 * @returns [{name, check, veto, weight, score, reason}]
 */
function explainPoints(caseDef, result) {
  const out = []
  for (const p of caseDef.points || []) {
    let score
    let reason
    if (p.check === 'judge') {
      const v = result.judgeScores && result.judgeScores[p.name]
      score = v === 1 ? 1 : 0
      reason = v === undefined ? '未跑 judge' : `judge=${v}`
    } else {
      score = evalPointProgram(p, result)
      reason = score === 1 ? 'program 命中' : 'program 未命中'
    }
    out.push({ name: p.name, check: p.check, veto: !!p.veto, weight: p.weight, score, reason })
  }
  return out
}

async function callChat(opt, file, input) {
  const agent = path.basename(file, '.yaml')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60000)
  try {
    const res = await fetch(`${opt.baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: input }], agent }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (res.status === 502) return { content: '', sources: null, httpStatus: 502 }
    if (!res.ok) return { content: '', sources: null, httpStatus: res.status }
    const data = await res.json()
    return {
      content: data?.data?.content ?? '',
      sources: data?.data?.sources ?? null,
      tokensIn: data?.data?.tokensIn,
      tokensOut: data?.data?.tokensOut,
      latencyMs: data?.data?.latencyMs,
      httpStatus: 200,
    }
  } catch {
    clearTimeout(timer)
    return { content: '', sources: null, httpStatus: 0 }
  }
}

async function judgeCase(opt, caseDef, result) {
  // 逐考点独立评委（F-A5 单维评委原则）：一个评委只评一个考点，0/1/UNKNOWN 三选一。
  // 用 chat（通用对话）当评委，避免复用被评测的专家 agent（自评偏置）。
  const scores = {}
  for (const p of caseDef.points) {
    if (p.check !== 'judge') continue
    const judgePrompt = `你是「一盏茶」AI 评测的独立评委。只判断下面这一个考点是否满足。
考点：${p.name}
用户输入：${caseDef.input}
AI 回答：${(result.content || '').slice(0, 2000)}
若满足输出 1；不满足输出 0；信息不足无法判断输出 UNKNOWN。只输出 0、1 或 UNKNOWN。`
    const r = await callChat(opt, 'chat.yaml', judgePrompt)
    if (!r.content) {
      scores[p.name] = 'UNKNOWN'
      continue
    }
    // F4：严格解析（0/1/UNKNOWN 三选一）；旧版 startsWith('1') 会把「10 分里给 1」误判为 1
    scores[p.name] = parseJudgeVerdict(r.content)
  }
  return scores
}

function mockResult(caseDef) {
  const content = caseDef.expected.split('；')[0] || caseDef.expected
  return { content, sources: ['茶·mock'], tokensIn: 10, tokensOut: 20, latencyMs: 100, httpStatus: 200 }
}

function loadCases(fileFilter) {
  const list = fileFilter ? [fileFilter] : FILES
  const out = []
  for (const file of list) {
    const full = path.join(CASES_DIR, file)
    if (!fs.existsSync(full)) { console.error(`缺文件: ${file}`); process.exit(1) }
    const doc = yaml.load(fs.readFileSync(full, 'utf8'))
    for (const c of doc.cases) out.push([file, c])
  }
  return out
}

function argVal(args, key, def) {
  const i = args.indexOf(key)
  return i >= 0 ? args[i + 1] : def
}

function printSummary(report) {
  const a = report.aggregate
  console.log(`评测: ${report.cases} 条 / 迭代 ${report.config.iterations} / judge ${report.config.judge ? 'on' : 'off'} / ${report.config.dryRun ? 'dry-run' : 'live'}`)
  console.log(`整体: ${a.overall} | 结果质量 ${a.dimensions.resultQuality} | 过程质量 ${a.dimensions.processQuality} | 安全稳定 ${a.dimensions.safetyStability}`)
  console.log(`pass^${report.config.iterations}: ${a.pass3.passed}/${a.pass3.total}`)
  // F-2 口径提示：judge 未跑时 overall 只代表 program 考点，须明示防误读
  const cov = a.judgeCoverage
  if (cov === null) {
    console.log('口径: 本批无 judge 考点，overall 即全量分')
  } else if (cov === 0) {
    console.log(`口径: ⚠️ judge 未跑（覆盖率 0/${report.cases} 条有 judge 考点）→ overall 仅代表 program 考点，programOnly=${a.programOnly}`)
  } else {
    console.log(`口径: judge 覆盖率 ${cov} | programOnly=${a.programOnly} | overall=${a.overall}`)
  }
  console.log(`报告: ${path.relative(ROOT, outPath(report))}`)
  if (report.failures.length > 0) {
    console.log(`失败 ${report.failures.length} 条:`)
    for (const f of report.failures) console.log(`  ${f.id} [${f.type}] ${f.score} http=${f.httpStatus} src=${f.sources} — ${f.contentSnippet || f.input.slice(0, 40)}`)
  }
}
function outPath(report) {
  return path.join(REPORTS_DIR, `${report.date}${report.config.dryRun ? '-dry' : ''}.json`)
}
