/**
 * RAG 审计口径（切词镜像 + KB 依赖判定），被 audit-eval-rag.cjs 与回归锁共用。
 *
 * CultureSearchService.splitKeywords 的 JS 镜像（RAG 审计与回归锁共用）。
 *
 * 为什么要有镜像：Java 侧切词策略决定「评测问题能不能命中种子语料」，但审计脚本要能在
 * 没有 JVM、没有 DB、没有后端的 CI 里跑。镜像必须与 Java 行为一致。
 *
 * 口径来源（改 Java 必须同步改这里，否则审计结论失真，回归锁会红）：
 *   backend/src/main/java/com/tea/culture/service/CultureSearchService.java
 *   · splitKeywords        · stripTailParticles
 *   · appendBigrams        · expandCategoryAliases
 *   · CATEGORY_ALIASES     · MAX_KEYWORDS
 *
 * 已知局限：本镜像只覆盖静态切词，不覆盖 ILIKE 落库命中（列选择、LIMIT 5、向量补缺都在
 * 运行期）。它回答「关键词有没有可能在语料里出现」，不回答「查询一定命中哪一行」。
 */
const MAX_KEYWORDS = 12
// 中文连接词/标点切分。Java 侧 ? 是 regex 元字符必须转义，! 不需要；这里保持同样语义。
const SPLIT_RE = /和|与|以及|还有|或|、|，|,|\?|？|!|！|。|\.|\s+/
// 无连接词长句的二次拆词（虚词/疑问词），顺序与 Java 一致（讲讲 在 讲 之前）
const SECOND_SPLIT_RE =
  /的|了|吗|呢|吧|啊|呀|哦|什么|怎么|怎样|哪里|多少|请问|介绍|推荐|讲讲|说说|为什么|如何|哪些|大概|讲|是|有|跟/
const TAIL_PARTICLES = '的了吗呢吧啊呀哦'
const CATEGORY_ALIASES = new Map([
  ['乌龙茶', '青茶'],
  ['乌龙', '青茶'],
  ['岩茶', '青茶'],
])

/** 剥离尾部语气虚词：陆羽的→陆羽（否则 ILIKE %陆羽的% 对 name=陆羽 miss）。 */
function stripTailParticles(w) {
  let s = w
  while (s.length > 1 && TAIL_PARTICLES.includes(s.charAt(s.length - 1))) {
    s = s.slice(0, -1)
  }
  return s
}

/** ≥4 字 token 追加非重叠 2 字切片（奇数长度补尾部一片），去重后附在整词之后。 */
function appendBigrams(kws, w) {
  if (w.length < 4) return
  for (let i = 0; i + 2 <= w.length && kws.length < MAX_KEYWORDS; i += 2) {
    if (!kws.includes(w.slice(i, i + 2))) kws.push(w.slice(i, i + 2))
  }
  if (w.length % 2 === 1 && kws.length < MAX_KEYWORDS) {
    const tail = w.slice(w.length - 2)
    if (!kws.includes(tail)) kws.push(tail)
  }
}

/** 类目别名展开：在 MAX_KEYWORDS 约束内追加库内分类用词。 */
function expandCategoryAliases(kws) {
  const out = kws.slice()
  for (const w of kws) {
    if (out.length >= MAX_KEYWORDS) break
    const cat = CATEGORY_ALIASES.get(w)
    if (cat && !out.includes(cat)) out.push(cat)
  }
  return out
}

/** 与 Java splitKeywords 同语义：连接词切分 → 虚词二次拆词 → bigram 召回 → 类目别名展开。 */
function splitKeywords(q) {
  const trimmed = String(q == null ? '' : q).trim()
  const parts = trimmed.split(SPLIT_RE)
  const tokens = []
  for (const raw of parts) {
    const p = raw.replace(/[《》"']/g, '').trim()
    if (p === '') continue
    if (parts.length > 1 || p.length <= 6) {
      const w = stripTailParticles(p)
      if (w.length >= 2) tokens.push(w)
      continue
    }
    for (const t of p.split(SECOND_SPLIT_RE)) {
      const w = stripTailParticles(t.trim())
      if (w.length >= 2) tokens.push(w)
    }
  }
  const kws = [...new Set(tokens)]
  for (const w of tokens) {
    if (kws.length >= MAX_KEYWORDS) break
    appendBigrams(kws, w)
  }
  const expanded = expandCategoryAliases(kws)
  return expanded.length === 0 ? [trimmed] : expanded
}

module.exports = {
  splitKeywords,
  MAX_KEYWORDS,
  stripTailParticles,
  appendBigrams,
  isKbDependent,
  isKbDependentNarrow,
  expectedMentionsKbHits,
}

/**
 * 语义口径 KB 依赖判定：program 考点「知识库命中」，或任意考点「引用…出处」。
 *
 * 现有实现（eval-tea-ai.cjs 的 kbDependent）只认「知识库命中」四个字，漏掉
 * 「引用知识库出处」这类等价诉求 —— 实测 50 条 case 里有 1 条（LIB-001）因此没进
 * ragRecallK 的样本。两口径都导出，审计打印差额，不静默替换。
 */
function isKbDependent(points) {
  const names = (points || []).map((p) => (typeof p?.name === 'string' ? p.name : ''))
  if (names.some((n) => n.includes('知识库命中'))) return true
  return names.some((n) => n.includes('引用') && n.includes('出处'))
}

/** 现有口径（eval-tea-ai.cjs）：只看考点名含「知识库命中」。 */
function isKbDependentNarrow(points) {
  return (points || []).some((p) => typeof p?.name === 'string' && p.name.includes('知识库命中'))
}

/**
 * 第三信号：expected 文本自己写了「知识库命中」（如 LIB-005「…特征（知识库命中）」）。
 * 它不代表考点已标注，只用来发现「期望依赖知识库、考点却没标」的漏标 case。
 */
function expectedMentionsKbHits(expected) {
  return typeof expected === 'string' && expected.includes('知识库命中')
}
