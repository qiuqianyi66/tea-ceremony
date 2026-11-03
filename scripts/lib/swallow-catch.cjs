/**
 * swallow-catch.cjs — R2 检出：Java catch 块体为空（含「只写注释」的空块）。
 *
 * 为什么抽成纯函数：R2 是红线门禁，改判据必须能双向验证（该报的报、该豁免的豁免）。
 * 有了纯函数就能拿固定 fixture 跑「改判据前后行为」的证据，而不是靠肉眼看审计输出。
 *
 * 判据（对照 .harness/rules/编码规范.md R2）：
 *   1. 任意异常类型（不再限定 Exception/RuntimeException）
 *   2. 块体剥掉块注释/行注释/空白后为空 → 命中
 *   3. 块内有 `// R2-allow: <理由>` 且理由 ≥ MIN_ALLOW_REASON 字 → 计为显式豁免
 *   4. 块体非空 → 不审视（降级/重试/清理语义不由 R2 判定）
 */

/** 豁免标注：必须写在 catch 块内 */
const ALLOW_RE = /\/\/\s*R2-allow:\s*([^\n]*)/g
/** 理由最短长度（字符数）：防 `// R2-allow: ok` 这类空话式豁免 */
const MIN_ALLOW_REASON = 8

/**
 * 从 catch 关键字位置起，做花括号匹配取出块体。
 * 跳过字符串/字符字面量与注释里的花括号，避免 `log.warn("}")` 这类内容把匹配带偏。
 */
function readCatchBlock(text, catchIndex) {
  let i = text.indexOf('{', catchIndex)
  if (i < 0) return null
  const start = i
  let depth = 0
  let inLineComment = false
  let inBlockComment = false
  let quote = null
  for (; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inLineComment) {
      if (c === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (c === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return { body: text.slice(start + 1, i) }
    }
  }
  return null
}

/**
 * 找出一段 Java 源码里所有「吞异常」的 catch 块。
 * @param {string} text Java 源码全文
 * @returns {Array<{index:number, exception:string, reason:string|null}>} index 为 catch 关键字在全文中的字符偏移
 */
function findSwallowCatches(text) {
  const out = []
  const re = /catch\s*\(([^)]*)\)\s*\{/g
  let m
  while ((m = re.exec(text))) {
    const block = readCatchBlock(text, m.index)
    if (!block) continue
    const codeOnly = block.body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, '')
    if (codeOnly !== '') continue

    // 参数形如 "Exception ignore" / "A | B e"：去掉末尾变量名只留异常类型
    const exception = m[1].replace(/\s+/g, ' ').trim().replace(/\s+\w+$/, '')

    let reason = null
    ALLOW_RE.lastIndex = 0
    let a
    while ((a = ALLOW_RE.exec(block.body))) {
      const candidate = a[1].trim()
      if (candidate.length >= MIN_ALLOW_REASON) {
        reason = candidate
        break
      }
    }
    out.push({ index: m.index, exception, reason })
  }
  return out
}

module.exports = { findSwallowCatches, MIN_ALLOW_REASON }
