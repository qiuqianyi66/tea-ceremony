/**
 * swallow-catch.cjs — R2 检出：Java catch 块体为空（含「只写注释」的空块）。
 *
 * 为什么抽成纯函数：R2 是红线门禁，改判据必须能双向验证（该报的报、不该报的不报）。
 *
 * 判据（对照 .harness/rules/编码规范.md R2）：
 *   1. 任意异常类型（不再限定 Exception/RuntimeException）
 *   2. 块体去掉注释/字符串字面量后只剩空白或空语句 `;` → 命中
 *   3. 块内有 `// R2-allow: <理由>` 且理由 ≥ MIN_ALLOW_REASON 字 → 计为显式豁免（理由回传给调用方）
 *   4. 块体有实质语句 → 不审视（降级/重试/清理语义不由 R2 判定）
 *
 * 关键实现点：扫描前先把「注释 / 字符串 / 字符字面量 / 文本块」整体涂成空格（长度与换行不变），
 * 再做正则与花括号匹配。否则仓库里用来举例的注释（如 `// 反例：catch (Exception e) {}`）
 * 会被当成真代码误报，而误报会让 CI 变红→逼人删注释或加假豁免，反过来削弱门禁。
 *
 * 已知边界（明确写下，不假装兜住）：
 *   1. 只判「块体为空」，非空块体一律不查——`catch (Exception e) { int x = 0; }` 这类 no-op 语句
 *      不在机械化范围，由人工评审覆盖。
 *   2. Java 文本块内出现转义引号 `\"""` 时掩码会提前闭合，可能把文本块里的示例 catch 误判（本仓 0 处）。
 */

const ALLOW_RE = /\/\/\s*R2-allow:\s*([^\n]*)/g
/** 理由最短长度（字符数）：防 `// R2-allow: ok` 这类空话式豁免 */
const MIN_ALLOW_REASON = 8
/** 理由里至少要有的「文字/数字」个数：防 `// R2-allow: ........` 用标点凑长度 */
const MIN_ALLOW_WORD_CHARS = 6

/** 去掉块注释尾巴与末端空白，并判断理由是否够实质（不能是纯标点） */
function normalizeReason(raw) {
  const cleaned = raw.replace(/[\s*/]+$/, '').trim()
  if (cleaned.length < MIN_ALLOW_REASON) return null
  const wordChars = (cleaned.match(/[\p{L}\p{N}]/gu) ?? []).length
  if (wordChars < MIN_ALLOW_WORD_CHARS) return null
  return cleaned
}

/**
 * 把非代码区（注释/字符串/字符/文本块）替换为空格，保留长度与换行，使字符偏移与原文一一对应。
 */
function maskNonCode(text) {
  const out = text.split('')
  const n = text.length
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = text[i]
    const next = text[i + 1]
    // 行注释
    if (c === '/' && next === '/') {
      const start = i
      while (i < n && text[i] !== '\n') i++
      blank(start, i)
      continue
    }
    // 块注释
    if (c === '/' && next === '*') {
      const start = i
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++
      i = Math.min(i + 2, n)
      blank(start, i)
      continue
    }
    // 文本块 """
    if (c === '"' && text.startsWith('"""', i)) {
      const start = i
      i += 3
      while (i < n && !text.startsWith('"""', i)) i++
      i = Math.min(i + 3, n)
      blank(start, i)
      continue
    }
    // 字符串 / 字符字面量
    if (c === '"' || c === "'") {
      const quote = c
      const start = i
      i++
      while (i < n) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === quote) {
          i++
          break
        }
        if (text[i] === '\n') break // 未闭合：不跨行，避免吞掉后续代码
        i++
      }
      blank(start, i)
      continue
    }
    i++
  }
  return out.join('')
}

/** 从 catch 关键字位置起，在「已掩码文本」上做花括号匹配取出块体区间。 */
function readCatchRange(masked, catchIndex) {
  let i = masked.indexOf('{', catchIndex)
  if (i < 0) return null
  const start = i
  let depth = 0
  for (; i < masked.length; i++) {
    const c = masked[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return { bodyStart: start + 1, bodyEnd: i }
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
  const masked = maskNonCode(text)
  const out = []
  const re = /catch\s*\(([^)]*)\)\s*\{/g
  let m
  while ((m = re.exec(masked))) {
    const range = readCatchRange(masked, m.index)
    if (!range) continue
    // 掩码后注释/字符串已变空格，只剩空白或空语句即为空块
    const codeOnly = masked.slice(range.bodyStart, range.bodyEnd).replace(/[\s;]/g, '')
    if (codeOnly !== '') continue

    // 参数形如 "Exception ignore" / "A | B e"：去掉末尾变量名只留异常类型
    const exception = m[1].replace(/\s+/g, ' ').trim().replace(/\s+\w+$/, '')

    // 理由从「原文」取（掩码会把它涂掉）；同一区间偏移一致
    const originalBody = text.slice(range.bodyStart, range.bodyEnd)
    let reason = null
    ALLOW_RE.lastIndex = 0
    let a
    while ((a = ALLOW_RE.exec(originalBody))) {
      const candidate = normalizeReason(a[1])
      if (candidate) {
        reason = candidate
        break
      }
    }
    out.push({ index: m.index, exception, reason })
  }
  return out
}

module.exports = { findSwallowCatches, maskNonCode, MIN_ALLOW_REASON }
