/**
 * calibrate-judge 校准核心单测（node --test）。
 * 覆盖：一致率计算 / 阈值判定 / 非法样本过滤 / A-B 不稳定标记。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { evaluate, THRESHOLD } = require('../calibrate-judge.cjs')

test('一致率：7/8 = 87.5%，高于阈值 85%', () => {
  const samples = [
    { id: 'A', human: 1, machine: 1 }, { id: 'B', human: 1, machine: 1 },
    { id: 'C', human: 1, machine: 1 }, { id: 'D', human: 1, machine: 1 },
    { id: 'E', human: 1, machine: 1 }, { id: 'F', human: 1, machine: 1 },
    { id: 'G', human: 1, machine: 1 }, { id: 'H', human: 1, machine: 0 },
  ]
  const r = evaluate(samples)
  assert.equal(r.rate, 7 / 8)
  assert.equal(r.mismatches.length, 1)
  assert.equal(r.mismatches[0].id, 'H')
  assert.ok(r.rate >= THRESHOLD)
})

test('一致率 50%：低于阈值', () => {
  const r = evaluate([
    { id: 'A', human: 1, machine: 1 }, { id: 'B', human: 0, machine: 1 },
  ])
  assert.equal(r.rate, 0.5)
  assert.ok(r.rate < THRESHOLD)
})

test('非法样本（非 0/1）被过滤不计入分母', () => {
  const r = evaluate([
    { id: 'A', human: 1, machine: 1 },
    { id: 'B', human: 1, machine: 2 },   // 非法
    { id: 'C', human: 'x', machine: 0 }, // 非法
  ])
  assert.equal(r.rate, 1)
  assert.equal(r.mismatches.length, 0)
})

test('A/B 不稳定标记独立上报，不影响一致率', () => {
  const r = evaluate([
    { id: 'A', human: 1, machine: 1, unstable: true },
    { id: 'B', human: 1, machine: 1 },
  ])
  assert.equal(r.rate, 1)
  assert.equal(r.unstable.length, 1)
  assert.equal(r.unstable[0].id, 'A')
})

test('空样本：一致率 0，不崩溃', () => {
  const r = evaluate([])
  assert.equal(r.rate, 0)
  assert.equal(r.mismatches.length, 0)
})
