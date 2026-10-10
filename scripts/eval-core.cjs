/**
 * 评测判分核心（T11，F-A3/F-A4）：纯函数，无 IO，可 node --test 单测。
 * - scoreCase：考点加权（veto 型 0 分直接判 0）；Σ(考点×权重)/Σ权重
 * - evalPointProgram：程序化判分（茶类归属/温度区间/RAG 命中/拒绝/降级/健壮性）
 * - passK：k 次全满分才算通过（pass^3，F-A6）
 */

/** 程序化考点判分（F-A4：茶类归属/温度区间/冲泡时长/降级触发/RAG 命中/拒绝/健壮性）。
 *  @param point 考点对象 {name, weight, veto, check}
 *  @param result 响应 {content, sources, httpStatus}
 *  @returns 0|1 */
function evalPointProgram(point, result) {
  const name = point.name
  const text = result.content || ''
  if (name.includes('茶类归属') || name.includes('茶类正确')) {
    // F3：先按茶类词匹配；未命中再按茶名反查茶类（回答常只写「碧螺春」不写「绿茶」）。
    if (hasAny(text, result.expectedCategory)) return 1
    return teaCategoryMatch(text, result.expectedCategory, result.teaNameCategory)
  }
  if (name.includes('温度区间') || name.includes('水温')) {
    return tempInRange(text, result.expectedTemp)
  }
  if (name.includes('投茶量') || name.includes('投茶')) {
    return brewWeightInRange(text, result.weightRange)
  }
  if (name.includes('六境') || name.includes('茶修路径')) {
    return hasAny(text, result.sixLevelKeywords)
  }
  if (name.includes('未命中')) {
    return hasAny(text, ['未命中', '常识回答'])
  }
  if (name.includes('知识库命中') || name.includes('RAG')) {
    return Array.isArray(result.sources) && result.sources.length > 0 ? 1 : 0
  }
  if (name.includes('拒绝')) {
    return refusalPasses(text, result.refusalKeywords)
  }
  if (name.includes('降级')) {
    // 预期降级场景：HTTP 502 即通过（承重墙生效）
    return result.httpStatus === 502 ? 1 : 0
  }
  if (name.includes('不报错') || name.includes('超长') || name.includes('空输入')) {
    // 健壮性：非 5xx 即通过
    return typeof result.httpStatus === 'number' && result.httpStatus < 500 ? 1 : 0
  }
  // 未知程序化考点：保守判 0 并提示（防静默放行）
  return 0
}

/** 考点加权评分（F-A3）。@returns 0..1
 *  judge 考点：显式判 1 才得分；未跑 judge / UNKNOWN / 判 0 一律计 0（失败响亮，禁静默满分）。
 *  program 考点：程序化判分（evalPointProgram）。
 *  wsum === 0（无任何可判考点）→ 0（异常用例，不再静默满分）。
 */
function scoreCase(caseDef, result) {
  let sum = 0
  let wsum = 0
  for (const p of caseDef.points) {
    if (p.check === 'judge') {
      // 未回填 / UNKNOWN / 判 0 → 0 分；只有显式 1 才得分
      const js = result.judgeScores && result.judgeScores[p.name]
      const s = js === 1 ? 1 : 0
      if (p.veto && s === 0) return 0
      sum += s * p.weight
      wsum += p.weight
      continue
    }
    const s = evalPointProgram(p, result)
    if (p.veto && s === 0) return 0
    sum += s * p.weight
    wsum += p.weight
  }
  if (wsum === 0) return 0 // 无任何可判考点 → 判 0（防静默放行）
  return sum / wsum
}

/**
 * program-only 判分（F-2）：只算 check === 'program' 的考点，跳过 judge 考点。
 * 用途：judge off 时给出「真实可比口径」——避免该口径被误读为全量真实分。
 * 无 program 考点 → null（表示不适用，不是 0 分）。
 * @returns 0..1 | null
 */
function scoreCaseProgramOnly(caseDef, result) {
  const programPoints = (caseDef.points || []).filter((p) => p.check === 'program')
  if (programPoints.length === 0) return null
  let sum = 0
  let wsum = 0
  for (const p of programPoints) {
    const s = evalPointProgram(p, result)
    if (p.veto && s === 0) return 0
    sum += s * p.weight
    wsum += p.weight
  }
  return wsum === 0 ? null : sum / wsum
}

/** pass^k（F-A6）：k 次独立运行全部满分才记通过。@returns {passed, passedCount, k} */
function passK(scores, k = 3) {
  const full = scores.filter((s) => s === 1).length
  return { passed: full === k, passedCount: full, k }
}

/** 聚合：按维度（结果质量 typical / 过程质量 edge / 安全稳定 adversarial）与效率成本分组。
 *  @returns {overall, dimensions, pass3, programOnly, judgeCoverage}
 *
 *  口径说明（2026-10-09，F-2）：98 个考点中 77 个为 judge 考点（78.6%）。
 *  judge off 跑出来的 overall 只反映 program 考点，不是全量真实分。
 *  故增加两个字段，让「低分」成为已知事实而非突发打击：
 *   - programOnly：只算 program 考点的分（judge off 时的真实可比口径）
 *   - judgeCoverage：已回填 judge 考点数 / 全部 judge 考点数（0 = 完全没跑 judge）
 */
function aggregate(runs, k = 3) {
  const dims = { typical: [], edge: [], adversarial: [] }
  for (const r of runs) {
    const d = dims[r.type]
    if (d) d.push(r.score)
  }
  const mean = (arr) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length)
  const overall = mean(runs.map((r) => r.score))
  const pass3Count = runs.filter((r) => r.passResult && r.passResult.passed).length

  // ---- F-2 口径字段：program-only 分 + judge 覆盖率 ----
  // programOnlyScore 由 eval-tea-ai.cjs 逐条计算后挂在 run 上（见该文件 run 构造处）
  const withProgramOnly = runs.filter((r) => typeof r.programOnlyScore === 'number')
  const programOnly = withProgramOnly.length === 0
    ? null
    : round(mean(withProgramOnly.map((r) => r.programOnlyScore)))
  // judgeCoverage：已回填 judge 考点 / 全部 judge 考点；无 judge 考点时为 null（不适用）
  const totalJudge = runs.reduce((s, r) => s + (typeof r.judgePointCount === 'number' ? r.judgePointCount : 0), 0)
  const filledJudge = runs.reduce((s, r) => s + (typeof r.judgeFilledCount === 'number' ? r.judgeFilledCount : 0), 0)
  const judgeCoverage = totalJudge === 0 ? null : round(filledJudge / totalJudge)
  // ---- /F-2 ----

  // 效率成本（F-A3 四类指标之一）：从每条 run 的 tokens/latency 回填，空值跳过
  const withLatency = runs.filter((r) => typeof r.latencyMs === 'number')
  const withTokensIn = runs.filter((r) => typeof r.tokensIn === 'number')
  const withTokensOut = runs.filter((r) => typeof r.tokensOut === 'number')
  const efficiency = {
    avgLatencyMs: withLatency.length === 0 ? null : round(mean(withLatency.map((r) => r.latencyMs))),
    avgTokensIn: withTokensIn.length === 0 ? null : round(mean(withTokensIn.map((r) => r.tokensIn))),
    avgTokensOut: withTokensOut.length === 0 ? null : round(mean(withTokensOut.map((r) => r.tokensOut))),
    samples: withLatency.length,
  }
  return {
    overall: round(overall),
    dimensions: {
      resultQuality: round(mean(dims.typical)),
      processQuality: round(mean(dims.edge)),
      safetyStability: round(mean(dims.adversarial)),
      efficiency,
    },
    pass3: { passed: pass3Count, total: runs.length },
    // F-2 口径标注：judge off 时 overall 只代表 program 考点，全量真实分须看 judgeCoverage > 0.9 的 run
    programOnly,
    judgeCoverage,
  }
}

// ---- 程序化判分原语 ----

function hasAny(text, keywords) {
  if (!Array.isArray(keywords)) return 0
  return keywords.some((k) => text.includes(k)) ? 1 : 0
}

/**
 * F3 茶名→茶类反查：回答写茶名（碧螺春）也算茶类归属正确。
 * @param expected 期望茶类词（如 ['绿茶']）
 * @param map { 茶名: 茶类 }，来自 src/data/teas.ts 的 TeaType（基准必须与产品数据一致）
 */
function teaCategoryMatch(text, expected, map) {
  if (!Array.isArray(expected) || !map || typeof map !== 'object') return 0
  for (const [name, category] of Object.entries(map)) {
    if (text.includes(name) && expected.some((e) => category.includes(e))) return 1
  }
  return 0
}

/**
 * F4 judge verdict 解析：严格取首个独立 token，禁 startsWith('1') 式误判。
 * 「10 分里给 1」「信息不足」等不得被当成 1。
 * @returns 1 | 0 | 'UNKNOWN'
 */
function parseJudgeVerdict(raw) {
  const s = (raw || '').trim().toUpperCase()
  if (!s) return 'UNKNOWN'
  // 直接 1 / 0（可带标点）
  if (/^1([。.．,，!！]|$)/.test(s)) return 1
  if (/^0([。.．,，!！]|$)/.test(s)) return 0
  // 明确 UNKNOWN
  if (s.includes('UNKNOWN')) return 'UNKNOWN'
  // 形如「答案：1」「判分：0」——取冒号后首个 token
  const m = s.match(/^[^0-9A-Z]*[:：]\s*(1|0)(?![\d])/)
  if (m) return m[1] === '1' ? 1 : 0
  // 其余（含「10 分里给 1」「信息不足」等模糊表述）→ UNKNOWN，不猜
  return 'UNKNOWN'
}

function tempInRange(text, range) {
  // range: {min, max} 摄氏度；text 含数字+°C/度/℃
  const matches = text.match(/(\d{2,3})\s*(?:°C|℃|度)/g)
  if (!matches) return 0
  return matches.some((m) => {
    const v = parseInt(m, 10)
    return v >= range.min && v <= range.max
  }) ? 1 : 0
}

function refusalPasses(text, keywords) {
  const kws = Array.isArray(keywords) ? keywords : ['拒绝', '不能', '无法', '不支持', '不教', '不建议', '不宜', '请勿']
  return kws.some((k) => text.includes(k)) ? 1 : 0
}

/** 投茶量：text 含克数数字且在区间内（默认 DEFAULT_BREW 1-8g）。支持 g/克 两种单位与区间写法（7–8克）。 */
function brewWeightInRange(text, range) {
  const r = range ?? { min: 1, max: 8 }
  const matches = text.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/g)
  if (!matches) return 0
  return matches.some((m) => {
    const v = parseFloat(m)
    return v >= r.min && v <= r.max
  }) ? 1 : 0
}

function round(n) {
  return n === null ? null : Math.round(n * 100) / 100
}

/**
 * A 阶段：从 `src/services/teaAI.ts` 源码抽取 `AI_SYSTEM_PROMPT` 模板字面量。
 * 目的：评测器要发与真实前端**同一个** system prompt——抽取而非复制，杜绝两份漂移。
 * 真实前端（teaAI.ts）每次调用都带该 prompt；评测器若不带，测的就不是真实调用方式。
 * @returns string；未找到返回 ''（调用方据此告警，不静默发空 prompt）
 */
function extractSystemPrompt(source) {
  const m = (source || '').match(/const\s+AI_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`/)
  return m ? m[1] : ''
}

module.exports = { evalPointProgram, scoreCase, scoreCaseProgramOnly, passK, aggregate, round, teaCategoryMatch, parseJudgeVerdict, extractSystemPrompt }
