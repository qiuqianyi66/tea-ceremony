#!/usr/bin/env node
/**
 * 六境词表跨语言一致性门禁（REQ-ai-eval-v6 F-V3）。
 *
 * 背景：`行茶/见性/归真` 与产品实际 `悟香/品境/茶心` 的漂移在 v4 已发生过一次
 * （见 `docs/ai-eval/ITERATIONS.md` 的 F2 修复项）——判分基准改了，mentor 提示词与
 * 评测集注释没跟上。两处手写词表必漂移，故机械化核对。
 *
 * 真源：`src/data/constants.ts` 的 `TEA_LEVELS[].name`
 * 校验对象：`MentorAgent.SYSTEM_PROMPT` 里的六境序列、`docs/ai-eval/cases/mentor.yaml` 的注释
 *
 * 期望输出：VALID + 词表；任何不一致 → ERRORS + exit 1。
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const errors = []

// ---- 真源：TEA_LEVELS ----
const constants = fs.readFileSync(path.join(ROOT, 'src/data/constants.ts'), 'utf8')
const start = constants.indexOf('export const TEA_LEVELS')
if (start < 0) {
  console.error('ERRORS: 未找到 TEA_LEVELS')
  process.exit(1)
}
const blockEnd = constants.indexOf('\n] as const', start)
const block = constants.slice(start, blockEnd > 0 ? blockEnd : start + 4000)
const truth = [...block.matchAll(/name: '([^']+)'/g)].map((m) => m[1])

if (truth.length !== 6) errors.push(`TEA_LEVELS 应有 6 个境界，实际 ${truth.length}：${truth.join('/')}`)

// ---- 被校验 1：MentorAgent.SYSTEM_PROMPT ----
const mentorJava = fs.readFileSync(path.join(ROOT, 'backend/src/main/java/com/tea/ai/agent/MentorAgent.java'), 'utf8')
const promptMatch = mentorJava.match(/SYSTEM_PROMPT = """([\s\S]*?)"""/)
if (!promptMatch) {
  errors.push('MentorAgent 未找到 SYSTEM_PROMPT 文本块')
} else {
  const prompt = promptMatch[1]
  // 提取「六境」顺序回答：识茶、知器、… 这一段
  const seqMatch = prompt.match(/六境」顺序回答：([^。]+)。/)
  if (!seqMatch) {
    errors.push('MentorAgent.SYSTEM_PROMPT 缺少「六境」顺序引导（REQ-ai-eval-v6 F-V3 要求必须引用）')
  } else {
    const seq = seqMatch[1].split('、').map((s) => s.trim())
    if (seq.join('|') !== truth.join('|')) {
      errors.push(`MentorAgent 六境顺序与 TEA_LEVELS 不一致\n    提示词: ${seq.join('→')}\n    TEA_LEVELS: ${truth.join('→')}`)
    }
  }
  // 旧的错误词表不得残留在提示词里
  for (const stale of ['行茶', '见性', '归真']) {
    if (prompt.includes(stale)) errors.push(`MentorAgent.SYSTEM_PROMPT 残留旧词表「${stale}」（产品实际为 ${truth.join('/')}）`)
  }
}

// ---- 被校验 2：评测集注释 ----
const mentorYaml = fs.readFileSync(path.join(ROOT, 'docs/ai-eval/cases/mentor.yaml'), 'utf8')
const yamlHeader = mentorYaml.split('\n').slice(0, 5).join('\n')
const yamlSeqMatch = yamlHeader.match(/六境（([^，]+)，TEA_LEVELS）/)
if (yamlSeqMatch) {
  const seq = yamlSeqMatch[1].split('→').map((s) => s.trim())
  if (seq.join('|') !== truth.join('|')) {
    errors.push(`mentor.yaml 注释的六境与 TEA_LEVELS 不一致\n    注释: ${seq.join('→')}\n    TEA_LEVELS: ${truth.join('→')}`)
  }
} else {
  errors.push('mentor.yaml 头部缺「六境（…→…，TEA_LEVELS）」注释')
}

// ---- 输出 ----
console.log(`六境真源（TEA_LEVELS）：${truth.join(' → ')}`)
if (errors.length > 0) {
  console.error(`\nERRORS (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('VALID：MentorAgent 提示词 / mentor.yaml 注释 与 TEA_LEVELS 一致')
