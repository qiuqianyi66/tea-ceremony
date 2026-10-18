#!/usr/bin/env node
/**
 * 告警规则与看板的机械化审计（替代 promtool 在本机不可用的场景）。
 *
 * 与 promtool 的分工：promtool 校验 PromQL 语法与配置结构（权威），
 * 本脚本多查一件 promtool 查不出的事——指标名是否真的在代码里埋过。两者都跑，不能互相替代。
 *
 * promtool（需 Docker，本地/CI 都用这条）：
 *   docker run --rm -v "$PWD/deploy/prometheus:/etc/prometheus:ro" --entrypoint promtool \
 *     prom/prometheus:v3.1.0 check rules /etc/prometheus/alerts.yml
 *   docker run --rm -v "$PWD/deploy/prometheus:/etc/prometheus:ro" --entrypoint promtool \
 *     prom/prometheus:v3.1.0 check config /etc/prometheus/prometheus.yml
 *
 * 为什么还需要它：本机 Docker Hub 一度拉不到 prom/prometheus，promtool 跑不了；
 * 而"规则写错"这类问题**上线后不会报错**——Prometheus 会安静地把非法表达式当成空结果，
 * 告警永远不响。那正是"静默失效"，只能靠确定性脚本在提交前拦住。
 *
 * 校验四类问题：
 *   1. 结构缺失：alert / expr / for / labels.severity / annotations.summary 缺一即错
 *   2. 指标名漂移：expr 里引用的 tea_* 指标必须能在 Java 代码里找到对应埋点
 *      （Micrometer 把 tea.ai.fallback.hit 导出成 tea_ai_fallback_hit_total，两边一旦不一致，
 *      看板与告警就永远读不到数据）
 *   3. 语法硬伤：括号/方括号不平衡、`by (...)` 为空、promql 里出现中文标点
 *   4. 看板 JSON：面板 expr 同样做指标名核对；panel id 唯一；gridPos 完整
 *
 * 用法：node scripts/verify-alert-rules.cjs   期望 ERRORS: []
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')
const ALERTS = path.join(ROOT, 'deploy/prometheus/alerts.yml')
const PROM_CFG = path.join(ROOT, 'deploy/prometheus/prometheus.yml')
const DASHBOARD = path.join(ROOT, 'deploy/grafana/dashboards/tea-ai-production.json')
const JAVA_DIR = path.join(ROOT, 'backend/src/main/java/com/tea')

/** 标准指标前缀：由 Micrometer/Spring 自动注册，不需要在业务代码里找 */
const STANDARD_PREFIXES = ['http_server_requests', 'jvm_', 'hikaricp_', 'process_', 'system_', 'tomcat_', 'logback_']

const errors = []
const warnings = []

function readText(p) {
  if (!fs.existsSync(p)) {
    errors.push(`文件缺失: ${path.relative(ROOT, p)}`)
    return null
  }
  return fs.readFileSync(p, 'utf8')
}

/** Micrometer 名称 → Prometheus 名称的规则：点/横线转下划线；计数器加 _total */
function toPromName(micrometerName) {
  return micrometerName.replace(/[.\-]/g, '_') + '_total'
}

/** 从 Java 源码里扫出所有 tea.* 埋点名 */
function collectEmittedMetrics() {
  const found = new Set()
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.java')) {
        const src = fs.readFileSync(full, 'utf8')
        // 直接字面量：counter("tea.x.y" / timer("tea.x.y"
        for (const m of src.matchAll(/(?:counter|timer|gauge|summary|DistributionSummary|Timer|Counter)\(\s*"(tea[^"]+)"/g)) {
          found.add(m[1])
        }
        // 常量：static final String METRIC_X = "tea.x.y"
        for (const m of src.matchAll(/String\s+[A-Z_]+\s*=\s*"(tea[^"]+)"/g)) {
          found.add(m[1])
        }
      }
    }
  }
  walk(JAVA_DIR)
  return found
}

/** 从 PromQL 中抽出所有像指标名的标识符 */
function extractMetricRefs(expr) {
  // 先去标签匹配器：{outcome="circuit_open", status=~"5.."} 里的都是标签值与标签名，
  // 不剥掉会把 circuit_open 当成指标名报假错（本脚本第一版就踩了这个坑）。
  const withoutLabels = expr.replace(/\{[^}]*\}/g, ' ')
  const refs = new Set()
  for (const m of withoutLabels.matchAll(/\b([a-z][a-z0-9_]{3,})\b/g)) {
    refs.add(m[1])
  }
  return refs
}

const PROMQL_FUNCS = new Set([
  'sum', 'rate', 'increase', 'irate', 'avg', 'min', 'max', 'count', 'clamp_min', 'clamp_max',
  'histogram_quantile', 'by', 'without', 'and', 'or', 'unless', 'on', 'ignoring', 'group_left',
  'group_right', 'offset', 'bool', 'le', 'quantile', 'stddev', 'stdvar', 'topk', 'bottomk',
  'absent', 'abs', 'ceil', 'floor', 'round', 'delta', 'idelta', 'deriv', 'predict_linear',
  'changes', 'resets', 'time', 'timestamp', 'label_replace', 'label_join', 'vector', 'scalar',
  'exp', 'ln', 'log2', 'log10', 'sqrt', 'sort', 'sort_desc', 'year', 'month', 'day_of_month',
])

function auditExpr(expr, where) {
  if (typeof expr !== 'string' || !expr.trim()) {
    errors.push(`${where}: expr 为空`)
    return
  }
  // 括号平衡
  let depth = 0
  for (const ch of expr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth < 0) break
  }
  if (depth !== 0) errors.push(`${where}: 圆括号不平衡（最终深度 ${depth}）`)
  const openBrackets = (expr.match(/\[/g) || []).length
  const closeBrackets = (expr.match(/\]/g) || []).length
  if (openBrackets !== closeBrackets) errors.push(`${where}: 方括号不平衡（[ ${openBrackets} 个，] ${closeBrackets} 个）`)
  // 中文标点
  if (/[，。；：（）]/.test(expr)) errors.push(`${where}: expr 含中文标点`)
  // by () 空
  if (/by\s*\(\s*\)/.test(expr)) errors.push(`${where}: by() 为空聚合维度`)
}

function auditRules(emitted) {
  const text = readText(ALERTS)
  if (!text) return
  let doc
  try {
    doc = yaml.load(text)
  } catch (e) {
    errors.push(`alerts.yml 不是合法 YAML: ${e.message}`)
    return
  }
  if (!doc || !Array.isArray(doc.groups)) {
    errors.push('alerts.yml 缺少 groups 数组')
    return
  }

  const seenAlerts = new Set()
  let ruleCount = 0

  for (const [gi, group] of doc.groups.entries()) {
    if (!group.name) errors.push(`groups[${gi}] 缺少 name`)
    if (!Array.isArray(group.rules) || group.rules.length === 0) {
      errors.push(`groups[${gi}] (${group.name}) 的 rules 为空`)
      continue
    }
    for (const [ri, rule] of group.rules.entries()) {
      const where = `${group.name}[${ri}]${rule.alert ? ` ${rule.alert}` : ''}`
      ruleCount++
      if (!rule.alert) errors.push(`${where}: 缺少 alert 名`)
      if (seenAlerts.has(rule.alert)) errors.push(`${where}: alert 名重复`)
      seenAlerts.add(rule.alert)
      if (!rule.for) errors.push(`${where}: 缺少 for（没有持续时间会产生抖动告警）`)
      // 表达式缩进写在 YAML 里是字符串，多行要能连成一条
      auditExpr(rule.expr, where)
      if (!rule.labels || !rule.labels.severity) errors.push(`${where}: 缺少 labels.severity`)
      else if (!['critical', 'warning', 'info'].includes(rule.labels.severity)) {
        errors.push(`${where}: severity=${rule.labels.severity} 不在 critical|warning|info`)
      }
      if (!rule.annotations || !rule.annotations.summary) errors.push(`${where}: 缺少 annotations.summary`)
      if (!rule.annotations || !rule.annotations.description) errors.push(`${where}: 缺少 annotations.description`)

      // 指标名核对
      for (const ref of extractMetricRefs(rule.expr)) {
        if (PROMQL_FUNCS.has(ref)) continue
        if (STANDARD_PREFIXES.some((p) => ref.startsWith(p))) continue
        if (!ref.includes('_')) continue // 标签值/关键字，不是指标名
        const isKnown = [...emitted].some((name) => toPromName(name) === ref)
        if (!isKnown) {
          errors.push(`${where}: 引用了未知指标 "${ref}"（代码里没有对应埋点，告警永远不会触发）`)
        }
      }
    }
  }
  if (ruleCount === 0) errors.push('alerts.yml 里一条规则都没有')
  return ruleCount
}

function auditPromConfig() {
  const text = readText(PROM_CFG)
  if (!text) return
  let doc
  try {
    doc = yaml.load(text)
  } catch (e) {
    errors.push(`prometheus.yml 不是合法 YAML: ${e.message}`)
    return
  }
  if (!doc.rule_files || !doc.rule_files.length) errors.push('prometheus.yml 未配置 rule_files，告警规则不会被加载')
  if (!doc.scrape_configs || !doc.scrape_configs.length) errors.push('prometheus.yml 没有 scrape_configs')
  const jobs = new Set()
  for (const sc of doc.scrape_configs || []) {
    if (jobs.has(sc.job_name)) errors.push(`scrape_configs 里 job_name 重复: ${sc.job_name}`)
    jobs.add(sc.job_name)
    if (!sc.static_configs || !sc.static_configs.length) errors.push(`job ${sc.job_name} 没有 targets`)
  }
}

function auditDashboard(emitted) {
  const text = readText(DASHBOARD)
  if (!text) return 0
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    errors.push(`看板 JSON 非法: ${e.message}`)
    return 0
  }
  if (!Array.isArray(doc.panels) || !doc.panels.length) {
    errors.push('看板没有面板')
    return 0
  }
  const ids = new Set()
  for (const panel of doc.panels) {
    const where = `看板面板 ${panel.id ?? '?'} ${panel.title ?? ''}`.trim()
    if (panel.id === undefined) errors.push(`${where}: 缺少 id`)
    else if (ids.has(panel.id)) errors.push(`${where}: panel id 重复`)
    ids.add(panel.id)
    if (!panel.gridPos || ['h', 'w', 'x', 'y'].some((k) => typeof panel.gridPos[k] !== 'number')) {
      errors.push(`${where}: gridPos 不完整（Grafana 会拒渲染）`)
    }
    for (const target of panel.targets || []) {
      auditExpr(target.expr, where)
      for (const ref of extractMetricRefs(target.expr || '')) {
        if (PROMQL_FUNCS.has(ref)) continue
        if (STANDARD_PREFIXES.some((p) => ref.startsWith(p))) continue
        if (!ref.includes('_')) continue
        const isKnown = [...emitted].some((name) => toPromName(name) === ref)
        if (!isKnown) errors.push(`${where}: 引用了未知指标 "${ref}"`)
      }
    }
  }
  return doc.panels.length
}

const emitted = collectEmittedMetrics()
const ruleCount = auditRules(emitted)
auditPromConfig()
const panelCount = auditDashboard(emitted)

console.log('=== 告警与看板审计 ===')
console.log(`代码内埋点 ${emitted.size} 个 | 告警规则 ${ruleCount ?? 0} 条 | 看板面板 ${panelCount} 个`)
if (warnings.length) {
  console.log(`⚠ ${warnings.length} 条人工核对：`)
  for (const w of warnings) console.log(`  - ${w}`)
}
console.log(`ERRORS: ${JSON.stringify(errors, null, 2)}`)
process.exit(errors.length ? 1 : 0)
