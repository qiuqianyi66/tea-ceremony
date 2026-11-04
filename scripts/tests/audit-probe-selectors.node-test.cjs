/**
 * audit-probe-selectors（探针死选择器审计）单测（node --test）。
 * 覆盖：真选择器不报 / 死 class、死 id、死属性值必报 / 插值选择器进「未覆盖」而非误报 /
 * 去重 / 豁免理由质量 / 豁免预算常量。
 *
 * 为什么要有：这个坑已发生两次——T4.1 删除养成链路后，多个探针仍在引用 `.plant-btn-3d`，
 * 跑得过却验不到。审计本身出错（漏报或误报）会让门禁重新变成装饰。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  findDeadSelectors,
  extractTokens,
  normalizeReason,
  PROBE_ALLOW_BUDGET,
} = require('../audit-probe-selectors.cjs')

const SRC = `
<template>
  <div class="ambient-btn-3d" title="切换到雨天">雨</div>
  <div class="dialog-btn confirm" data-role="ok">好</div>
  <section id="garden-panel">…</section>
</template>
`

test('真选择器（class / id / title / data-* 都在 src）→ 不报', () => {
  const probe = [
    `page.locator('.ambient-btn-3d[title="切换到雨天"]')`,
    `page.locator('#garden-panel')`,
    `page.locator('[data-role="ok"]')`,
  ].join('\n')
  const { dead, dynamic } = findDeadSelectors(probe, SRC)
  assert.deepEqual(dead, [])
  assert.deepEqual(dynamic, [])
})

test('死 class → 必报', () => {
  const { dead } = findDeadSelectors(`page.locator('.plant-btn-3d')`, SRC)
  assert.equal(dead.length, 1)
  assert.match(dead[0], /plant-btn-3d/)
})

test('死 id → 必报（只验 class 会漏）', () => {
  const { dead } = findDeadSelectors(`page.locator('#dead-panel')`, SRC)
  assert.equal(dead.length, 1)
  assert.match(dead[0], /id:dead-panel/)
})

test('属性值不匹配 → 必报（只验属性名会漏）', () => {
  const { dead } = findDeadSelectors(`page.locator('[data-role="deleted-value"]')`, SRC)
  assert.equal(dead.length, 1)
  assert.match(dead[0], /data-role="deleted-value"/)
})

test('单引号内含双引号的属性选择器可解析（旧实现整段漏报）', () => {
  const { dead } = findDeadSelectors(`page.locator('[title="浇水"]')`, SRC)
  assert.equal(dead.length, 1)
})

test('模板插值选择器 → 进「未覆盖」而不是误报', () => {
  const probe = 'page.locator(`.item-${i}`)'
  const { dead, dynamic } = findDeadSelectors(probe, SRC)
  assert.deepEqual(dead, [])
  assert.equal(dynamic.length, 1)
  assert.match(dynamic[0], /item-\$\{i\}/)
})

test('扩展方法集：selectOption / isChecked / getByTestId 也纳入扫描', () => {
  assert.equal(findDeadSelectors(`page.selectOption('.gone', 'v')`, SRC).dead.length, 1)
  assert.equal(findDeadSelectors(`page.isChecked('.gone')`, SRC).dead.length, 1)
  assert.equal(findDeadSelectors(`page.getByTestId('gone')`, SRC).dead.length, 1)
})

test('同一选择器重复出现只报一次（去重）', () => {
  const probe = `page.locator('.gone').click(); page.locator('.gone').isVisible()`
  assert.equal(findDeadSelectors(probe, SRC).dead.length, 1)
})

test('不带 token 的伪类选择器不参与判定', () => {
  assert.deepEqual(findDeadSelectors(`page.locator(':root')`, SRC).dead, [])
})

test('extractTokens 产出 class / id / attr 三类', () => {
  const kinds = extractTokens('.a#b[title="c"]').tokens.map((t) => t.kind)
  assert.deepEqual(kinds.sort(), ['attr', 'class', 'id'])
})

test('豁免理由：≥8 字且含 ≥6 个文字/数字才算数', () => {
  assert.equal(normalizeReason('客户端已断连无需再发通知'), '客户端已断连无需再发通知')
  assert.equal(normalizeReason('........'), null)
  assert.equal(normalizeReason('太短'), null)
})

test('豁免是预算不是通道：预算常量为 3（与红线 R2 同思路）', () => {
  assert.equal(PROBE_ALLOW_BUDGET, 3)
})
