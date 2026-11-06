/**
 * eval-harness review 结论解析单测（node --test）。
 * 覆盖：取文末 Verdict 而非首个匹配（#147 回归锁）/ 数字与中文计数 / 无匹配不放行 / 多匹配取最后。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseReviewClean, metaHeader, adrVerdict, touchesSchemaPath, deriveNoMigrate, judgePass } = require('../eval-harness.cjs')

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

// ---- 报告元信息头：生成器必须自带，否则手补的头会被下一次评估覆盖 ----

test('metaHeader 产出 verify-harness 认可的 docs 元信息头', () => {
  const h = metaHeader('2026-11-04')
  assert.ok(h.startsWith('---\n'), 'frontmatter 必须在文件第一行')
  assert.match(h, /last_updated: 2026-11-04/)
  assert.match(h, /status: active/)
  assert.match(h, /owner: yanha/)
  // 与 verify-harness 的判定同构：/^---\n(...)\n---/ 且块内含 last_updated 才算合格
  const m = h.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  assert.ok(m && m[0].includes('last_updated'), 'v.5 判据：块内必须含 last_updated')
})

test('metaHeader 接在报告正文前时，首行仍是 ---（不产生前置空行）', () => {
  const doc = [metaHeader('2026-11-04'), '# eval-harness: demo', ''].join('\n')
  assert.equal(doc.split('\n')[0], '---')
  assert.ok(doc.includes('# eval-harness: demo'))
})

// ---- ADR 判据：只看文件证据，不看 summary 措辞 ----

test('ADR：纯脚本/文档切片 → 不适用（旧实现被「无数据库迁移」里的「迁移」骗到过）', () => {
  const v = adrVerdict(['scripts/eval-harness.cjs', '.harness/changes/x/summary.md', 'docs/agent-eval/x-eval.md'])
  assert.equal(v.applicable, false)
  assert.equal(v.ok, false)
})

test('ADR：只改服务类 Java（非 entity）→ 不适用', () => {
  const v = adrVerdict(['backend/src/main/java/com/tea/ai/service/AiChatService.java'])
  assert.equal(v.applicable, false)
})

test('ADR：动了迁移脚本但没写 ADR → 适用且未满足', () => {
  const v = adrVerdict(['.harness/changes/x/db-migrations.sql', 'backend/src/main/resources/db/migration/V3__add.sql'])
  assert.equal(v.applicable, true)
  assert.equal(v.touchesSchema, true)
  assert.equal(v.ok, false)
})

test('ADR：动了 entity → 适用', () => {
  const v = adrVerdict(['backend/src/main/java/com/tea/garden/entity/Plant.java'])
  assert.equal(v.applicable, true)
})

test('ADR：写了 docs/ADR → 适用且满足', () => {
  const v = adrVerdict(['docs/ADR/ADR-030-watering.md', 'backend/src/main/java/com/tea/garden/entity/Plant.java'])
  assert.equal(v.applicable, true)
  assert.equal(v.ok, true)
})
// ---- 零迁移判定：文件证据优先于 summary 措辞 ----

test('零迁移：无文件证据时按 summary 声明', () => {
  assert.deepEqual(deriveNoMigrate([], '本切片无数据库迁移'), { value: true, conflict: false })
  assert.deepEqual(deriveNoMigrate([], '改了脚本'), { value: false, conflict: false })
})

test('零迁移：声明「无迁移」但 commit 里有 db-migrations.sql → 按文件判为有迁移并报冲突', () => {
  assert.deepEqual(deriveNoMigrate(['.harness/changes/x/db-migrations.sql'], '本切片无数据库迁移'), {
    value: false,
    conflict: true,
  })
})

test('零迁移：声明「无迁移」且文件里确实没有迁移脚本 → 豁免成立', () => {
  assert.deepEqual(deriveNoMigrate(['scripts/eval-harness.cjs'], '本切片无数据库迁移'), { value: true, conflict: false })
})

// ---- 数据模型路径识别（含前端 Dexie 表结构） ----

test('schema 路径：前端 Dexie db.ts 也算数据模型（AGENTS §8 的 L3）', () => {
  assert.equal(touchesSchemaPath('src/services/storage/db.ts'), true)
  assert.equal(touchesSchemaPath('backend/src/main/java/com/tea/x/entity/Plant.java'), true)
  assert.equal(touchesSchemaPath('scripts/lib/swallow-catch.cjs'), false)
})

// ---- 通过判定：安全是一票否决项，不能被其他维度平均掉 ----

test('judgePass：总分达标但安全有违规 → FAIL（92 分也拦）', () => {
  // 安全归零、其余六维满分：加权后 92 分，旧判据（单看总分）会放行
  assert.equal(judgePass(92, 0), false)
})

test('judgePass：总分未达标 → FAIL，即使安全零违规', () => {
  assert.equal(judgePass(59, 100), false)
})

test('judgePass：总分达标且安全零违规 → PASS', () => {
  assert.equal(judgePass(60, 100), true)
  assert.equal(judgePass(88, 100), true)
})

test('judgePass：安全维无证据 → 未验证，不计入通过（对齐 skillkit SK-05 未验证不得标 PASS）', () => {
  // 切片无可归属 commit 时安全维扫不到任何东西：那是「未验证」，不是「合规」
  assert.equal(judgePass(92, 100, false), false)
  assert.equal(judgePass(100, 100, false), false)
})

test('judgePass：第三参缺省视为已验证（兼容旧调用点）', () => {
  assert.equal(judgePass(60, 100), true)
})