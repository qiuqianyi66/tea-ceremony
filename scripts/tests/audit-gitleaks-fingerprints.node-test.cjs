/**
 * 放行单漂移审计回归锁（node --test，纯 fs 无依赖）。
 *
 * 锁的是「指纹指针不漂」这条判据本身：2026-11-04 在 ci.yml 上方插入 5 行后，`.gitleaksignore`
 * 里 `ci.yml:generic-api-key:231` 失效 → secret-scan 无故变红，排查方向被带偏。
 * 下面四个用例分别覆盖 越界 / 文件缺失 / 指针指向非密钥行 / 行内双保险。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseFingerprints, audit } = require('../audit-gitleaks-fingerprints.cjs')

test('parseFingerprints 跳过注释与空行，路径里含冒号也能解析', () => {
  const text = [
    '# 注释行',
    '',
    '.github/workflows/ci.yml:generic-api-key:237',
    'backend/src/test/resources/application.yml:generic-api-key:62',
  ].join('\n')

  const fps = parseFingerprints(text)

  assert.equal(fps.length, 2)
  assert.deepEqual(fps[0], {
    path: '.github/workflows/ci.yml',
    rule: 'generic-api-key',
    line: 237,
    raw: '.github/workflows/ci.yml:generic-api-key:237',
  })
})

test('行号越界判红：文件变短时指纹必然失效', () => {
  const { errors } = audit([{ path: 'a.yml', rule: 'generic-api-key', line: 99, raw: 'a.yml:r:99' }],
    () => 'JWT_SECRET: abc\nsecret: x')

  assert.equal(errors.length, 1)
  assert.match(errors[0], /行号越界/)
})

test('文件缺失判红：改名/移动后不能静默通过', () => {
  const { errors } = audit([{ path: 'gone.yml', rule: 'r', line: 1, raw: 'gone.yml:r:1' }], () => {
    throw new Error('ENOENT')
  })

  assert.equal(errors.length, 1)
  assert.match(errors[0], /文件不存在/)
})

test('指针指向非密钥行判 WARN（漂移的典型形态），不误判为红', () => {
  const { errors, warns } = audit([{ path: 'a.yml', rule: 'r', line: 2, raw: 'a.yml:r:2' }],
    () => '# 只是注释\n          # name: Run Maven tests')

  assert.equal(errors.length, 0)
  assert.equal(warns.length, 1)
  assert.match(warns[0], /疑似漂移/)
})

test('行内 gitleaks:allow 记 INFO（双保险），健康指针不吵', () => {
  const text = '# a\nJWT_SECRET: abc # gitleaks:allow\nDB_PASSWORD: p@ss'
  const { errors, warns, infos } = audit(
    [
      { path: 'a.yml', rule: 'r', line: 2, raw: 'a.yml:r:2' },
      { path: 'a.yml', rule: 'r', line: 3, raw: 'a.yml:r:3' },
    ],
    () => text,
  )

  assert.equal(errors.length, 0)
  assert.equal(warns.length, 0)
  assert.equal(infos.length, 1)
  assert.match(infos[0], /双保险/)
})
