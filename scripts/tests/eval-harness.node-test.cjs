/**
 * eval-harness review 结论解析单测（node --test）。
 * 覆盖：取文末 Verdict 而非首个匹配（#147 回归锁）/ 数字与中文计数 / 无匹配不放行 / 多匹配取最后。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseReviewClean } = require('../eval-harness.cjs')

test('#147 回归锁：Findings 摘要先列未清零，文末 Verdict 清零 → 判 true（必须取最后一个匹配）', () => {
  const text = [
    '# review',
    '',
    '## Findings',
    '- 🔴 0 条 / 🟡 3 条（已修复，见 commits）',
    '',
    '## Verdict',
    '🔴 0 / 🟡 0 — 清零通过',
  ].join('\n')
  assert.equal(parseReviewClean(text), true)
})

test('未清零 → false（🔴 或 🟡 任一非零）', () => {
  assert.equal(parseReviewClean('🔴 2 / 🟡 1 待修复'), false)
  assert.equal(parseReviewClean('🔴 0 / 🟡 2 未修'), false)
})

test('中文计数「零/无」→ true', () => {
  assert.equal(parseReviewClean('🔴 零 / 🟡 零'), true)
  assert.equal(parseReviewClean('🔴 无 / 🟡 无'), true)
})

test('无匹配 → false（不给分，失败响亮）', () => {
  assert.equal(parseReviewClean('普通评审记录，没有计数行'), false)
  assert.equal(parseReviewClean(''), false)
})

test('多个匹配取最后一个：初评非零、终审清零 → true', () => {
  assert.equal(parseReviewClean('🔴 3 / 🟡 5 初评\n修复后\n🔴 0 / 🟡 0 终审'), true)
})

test('多个匹配取最后一个：先清零、复测又发现问题 → false', () => {
  assert.equal(parseReviewClean('🔴 0 / 🟡 0\n复测发现 🔴 1 / 🟡 1'), false)
})
