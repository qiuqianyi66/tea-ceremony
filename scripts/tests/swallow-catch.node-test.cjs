/**
 * swallow-catch（R2 判据）双向回归锁（node --test）。
 *
 * 为什么要有这个文件：判据扩到「任意异常类型 + 含仅注释的空块」后，最容易的失败方式是
 * 一边漏报（该拦的拦住不了）与一边误报（仓库里举例的注释被当真代码）。误报会逼人删注释或
 * 写假豁免，反而削弱门禁，所以两个方向都必须锁死。
 *
 * 用例来源：.harness/changes/gate-reliability/review.md §2.1 的 10 项双向 fixture
 * （原先只存在于 .tmp/ 临时脚本，本文件把它固化进仓库，可复跑）。
 *
 * 运行：node --test scripts/tests/swallow-catch.node-test.cjs
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { findSwallowCatches, MIN_ALLOW_REASON } = require('../lib/swallow-catch.cjs')

const hits = (code) => findSwallowCatches(code)

// ---------- 该报的必须报 ----------

test('p1 空块 catch(Exception) → 命中', () => {
  const r = hits('class A { void f() { try { g(); } catch (Exception e) { } } }')
  assert.equal(r.length, 1)
  assert.equal(r[0].reason, null)
})

test('p2 具体异常类型 + 块内只有注释 → 命中（旧判据的类型盲区）', () => {
  const r = hits(`class A { void f() {
  try { g(); } catch (DataIntegrityViolationException e) {
    // 唯一索引兜底
  }
} }`)
  assert.equal(r.length, 1)
  assert.equal(r[0].exception, 'DataIntegrityViolationException')
  assert.equal(r[0].reason, null, '普通注释不是豁免，必须仍报')
})

test('p3 块体只有空语句 ; → 命中', () => {
  const r = hits('class A { void f() { try { g(); } catch (RuntimeException e) { ; } } }')
  assert.equal(r.length, 1)
})

test('p4 ) 与 { 之间夹块注释 → 命中', () => {
  const r = hits('class A { void f() { try { g(); } catch (IllegalStateException e) /* 说明 */ { } } }')
  assert.equal(r.length, 1)
})

test('p5 豁免理由过短 → 仍判违规（reason 为 null）', () => {
  const r = hits(`class A { void f() {
  try { g(); } catch (Exception e) { // R2-allow: 没办法
  }
} }`)
  assert.equal(r.length, 1)
  assert.equal(r[0].reason, null)
})

test('p5b 豁免理由用标点凑长度 → 仍判违规（防 8 个点绕过）', () => {
  const r = hits(`class A { void f() {
  try { g(); } catch (Exception e) { // R2-allow: ........
  }
} }`)
  assert.equal(r.length, 1)
  assert.equal(r[0].reason, null)
})

// ---------- 不该报的一个都不许报 ----------

test('n1/n2 行注释与 javadoc 里举例的 catch 不算真代码', () => {
  const r = hits(`class A {
  // 反例：catch (Exception e) {}
  /** 反例：catch (Exception e) { } */
  void ok() { g(); }
}`)
  assert.equal(r.length, 0)
})

test('n3 块注释里举例的 catch 不算真代码', () => {
  const r = hits(`class A {
  /* 反例：catch (Exception e) {} */
  void ok() { g(); }
}`)
  assert.equal(r.length, 0)
})

test('n4 字符串字面量里举例的 catch 不算真代码', () => {
  const r = hits('class A { String s = "catch (Exception e) {}"; }')
  assert.equal(r.length, 0)
})

test('n5 文本块里举例的 catch 不算真代码', () => {
  const r = hits(`class A {
  String s = """
    catch (Exception e) {}
    """;
}`)
  assert.equal(r.length, 0)
})

test('n6 有实质语句的块体不审视（含字符串里的 } 不破坏花括号匹配）', () => {
  const r = hits(`class A { void f() {
  try { g(); } catch (Exception e) { log.warn("}", e); }
} }`)
  assert.equal(r.length, 0)
})

test('n7 合法豁免 → 命中但带出理由正文（由调用方决定放行）', () => {
  const r = hits(`class A { void f() {
  try { g(); } catch (Exception e) { // R2-allow: 客户端已断连，再发只会二次失败
  }
} }`)
  assert.equal(r.length, 1)
  assert.ok(r[0].reason && r[0].reason.length >= MIN_ALLOW_REASON, `reason=${r[0].reason}`)
})

test('n8 掩码不吞后续真实代码：未闭合字符串不跨行', () => {
  const r = hits(`class A { void f() {
  String broken = "oops
  try { g(); } catch (Exception e) { }
} }`)
  assert.equal(r.length, 1, '字符串未闭合时掩码到行尾即止，后面的真 catch 仍须命中')
})

test('n9 转义引号不破坏掩码边界', () => {
  const r = hits('class A { String p = "C:\\\\"; void f() { try { g(); } catch (Exception e) { } } }')
  assert.equal(r.length, 1)
})
