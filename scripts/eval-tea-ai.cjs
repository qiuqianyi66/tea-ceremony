#!/usr/bin/env node
/**
 * 一盏茶 AI 评测器（T11，F-A3/F-A4/F-A5/F-A6）。
 * 用法：
 *   node scripts/eval-tea-ai.cjs                      # 全量，1 次迭代（不跑 judge）
 *   node scripts/eval-tea-ai.cjs --iterations 3       # pass^3 正式跑
 *   node scripts/eval-tea-ai.cjs --judge              # 启用 LLM-as-Judge（调 /api/v1/ai/chat agent=mentor）
 *   node scripts/eval-tea-ai.cjs --file librarian.yaml --subset 2   # 单文件前 N 条
 *   node scripts/eval-tea-ai.cjs --dry-run            # 不调 API，验证管道（mock 响应）
 * 依赖：后端容器 tea-backend-1（18080）；AI key 在 .env（AI_DASHSCOPE_API_KEY），承重墙 502 降级可测。
 * 判分核心在 scripts/eval-core.cjs（纯函数，node --test 单测）。
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { scoreCase, passK, aggregate, round } = require('./eval-core.cjs')

const ROOT = path.join(__dirname, '..')
const CASES_DIR = path.join(ROOT, 'docs', 'ai-eval', 'cases')
const REPORTS_DIR = path.join(ROOT, 'docs', 'ai-eval', 'reports')
const FILES = ['advisor.yaml', 'taster.yaml', 'librarian.yaml', 'brewer.yaml', 'mentor.yaml', 'chat.yaml']

// ---- program 判分基准（来源：src/data/teas.ts + teaProcesses.ts + constants.ts，2026-10-09 核验）----
// 茶类归属：case id → 期望茶类关键词（输出必须出现）
const CATEGORY_EXPECT = {
  'LIB-001': ['乌龙茶'],
  'LIB-005': ['黄茶'],
  'ADV-001': ['乌龙茶', '绿茶'],
  'ADV-004': ['岩茶', '普洱', '滇红'],
  'BRE-001': ['乌龙茶'],
  'BRE-003': ['黑茶'],
  'BRE-004': ['白茶'],
}
// 温度区间：case id → {min, max}（输出含该区间内温度数字即通过）
const TEMP_EXPECT = {
  'BRE-001': { min: 90, max: 100 },
  'BRE-002': { min: 80, max: 85 },
  'BRE-003': { min: 95, max: 100 },
  'BRE-004': { min: 85, max: 90 },
}
// 拒绝类考点默认关键词
const REFUSAL_KEYWORDS = ['拒绝', '不能', '无法', '不支持', '抱歉', '无法提供']

const args = process.argv.slice(2)
const opt = {
  baseUrl: argVal(args, '--base-url', 'http://localhost:18080'),
  iterations: parseInt(argVal(args, '--iterations', '1'), 10),
  judge: args.includes('--judge'),
  dryRun: args.includes('--dry-run'),
  file: argVal(args, '--file', null),
  subset: parseInt(argVal(args, '--subset', '0'), 10),
}
const cases = loadCases(opt.file)
const runs = []
const failures = []

for (const [file, caseDef] of cases) {
  if (opt.subset > 0 && runs.length >= opt.subset) break
  const results = []
  for (let i = 0; i < opt.iterations; i++) {
    const result = opt.dryRun ? mockResult(caseDef) : callChat(opt, file, caseDef.input)
    const resultWithMeta = { ...result, expectedCategory: CATEGORY_EXPECT[caseDef.id], expectedTemp: TEMP_EXPECT[caseDef.id], refusalKeywords: REFUSAL_KEYWORDS }
    if (opt.judge) resultWithMeta.judgeScores = judgeCase(opt, caseDef, result)
    results.push(resultWithMeta)
  }
  const scores = results.map((r) => scoreCase(caseDef, r))
  const pk = passK(scores, opt.iterations)
  const last = results[results.length - 1] ?? {}
  const run = { id: caseDef.id, file, type: caseDef.type, input: caseDef.input.slice(0, 60), score: round(scores[0] ?? 0), passResult: pk, httpStatus: last.httpStatus, contentSnippet: (last.content || '').slice(0, 80), sources: Array.isArray(last.sources) ? last.sources.length : null }
  runs.push(run)
  if (run.score < 1) failures.push({ id: caseDef.id, type: caseDef.type, score: run.score, input: caseDef.input, httpStatus: run.httpStatus, contentSnippet: run.contentSnippet, sources: run.sources })
}

const report = {
  date: new Date().toISOString().slice(0, 10),
  config: { iterations: opt.iterations, judge: opt.judge, dryRun: opt.dryRun },
  cases: runs.length,
  aggregate: aggregate(runs, opt.iterations),
  failures,
}
fs.mkdirSync(REPORTS_DIR, { recursive: true })
const out = path.join(REPORTS_DIR, `${report.date}${opt.dryRun ? '-dry' : ''}.json`)
fs.writeFileSync(out, JSON.stringify(report, null, 2))
printSummary(report, opt)

// ---- IO ----

function callChat(opt, file, input) {
  const agent = path.basename(file, '.yaml')
  const body = { messages: [{ role: 'user', content: input }], agent }
  try {
    const res = fetchSync(`${opt.baseUrl}/api/v1/ai/chat`, body)
    if (res.status === 502) return { content: '', sources: null, httpStatus: 502 }
    if (!res.ok) return { content: '', sources: null, httpStatus: res.status }
    const data = res.json
    return {
      content: data?.data?.content ?? '',
      sources: data?.data?.sources ?? null,
      tokensIn: data?.data?.tokensIn,
      tokensOut: data?.data?.tokensOut,
      latency: data?.data?.latency,
      httpStatus: 200,
    }
  } catch {
    return { content: '', sources: null, httpStatus: 0 }
  }
}

function judgeCase(opt, caseDef, result) {
  const judgePrompt = `你是「一盏茶」AI 评测的评委。判断 AI 助手回答是否满足指定考点。
考点：${caseDef.points.map((p) => p.name).join('；')}
用户输入：${caseDef.input}
AI 回答：${(result.content || '').slice(0, 2000)}
若全部满足输出 1；任一不满足输出 0。只输出 0 或 1。`
  const r = callChat(opt, 'mentor.yaml', judgePrompt)
  if (!r.content) return {}
  const verdict = r.content.trim().match(/^[01]/)
  const scores = {}
  if (verdict) {
    for (const p of caseDef.points) scores[p.name] = parseInt(verdict[0], 10)
  }
  return scores
}

function mockResult(caseDef) {
  // dry-run：program 考点给通过样本，judge 考点中性（scoreCase 会跳过 judge 未回填）
  const content = caseDef.expected.split('；')[0] || caseDef.expected
  return {
    content,
    sources: ['茶·mock'],
    tokensIn: 10, tokensOut: 20, latency: 100,
    httpStatus: 200,
  }
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

function fetchSync(url, body) {
  const lib = require('node:http')
  const u = new URL(url)
  const payload = JSON.stringify(body)
  const req = lib.request({
    hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  }, (res) => {
    let raw = ''
    res.on('data', (d) => { raw += d })
    res.on('end', () => {
      req.result = { status: res.statusCode, json: raw ? JSON.parse(raw) : null }
    })
  })
  req.on('error', () => { req.result = { status: 0, json: null } })
  req.write(payload)
  req.end()
  // 同步等待（Node <18 无 fetch；脚本保持零依赖同步风格）；LLM 调用慢，60s 上限
  const deadline = Date.now() + 60000
  while (!req.result && Date.now() < deadline) { /* busy wait */ }
  if (!req.result) req.destroy()
  return req.result ?? { status: 0, json: null }
}

function argVal(args, key, def) {
  const i = args.indexOf(key)
  return i >= 0 ? args[i + 1] : def
}

function printSummary(report, opt) {
  const a = report.aggregate
  console.log(`评测: ${report.cases} 条 / 迭代 ${report.config.iterations} / judge ${report.config.judge ? 'on' : 'off'} / ${report.config.dryRun ? 'dry-run' : 'live'}`)
  console.log(`整体: ${a.overall} | 结果质量 ${a.dimensions.resultQuality} | 过程质量 ${a.dimensions.processQuality} | 安全稳定 ${a.dimensions.safetyStability}`)
  console.log(`pass^3: ${a.pass3.passed}/${a.pass3.total}`)
  console.log(`报告: ${path.relative(ROOT, out)}`)
  if (report.failures.length > 0) {
    console.log(`失败 ${report.failures.length} 条:`)
    for (const f of report.failures) console.log(`  ${f.id} [${f.type}] ${f.score} http=${f.httpStatus} src=${f.sources} — ${f.contentSnippet || f.input.slice(0, 40)}`)
  }
}
