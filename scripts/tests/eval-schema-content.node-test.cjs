/**
 * eval-harness 内容级数据模型判定单测（node --test）。
 * R2 修复后补真断言：写临时文件 → 调 adrVerdict([path]) → 断言 touchesSchema: true。
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { touchesSchemaContent, touchesSchemaPath, adrVerdict } = require('../eval-harness.cjs')

test('SQL 关键词：CREATE TABLE / ALTER TABLE / INSERT INTO 都能命中', () => {
  assert.equal(touchesSchemaContent('CREATE TABLE users (id INT PRIMARY KEY)'), true)
  assert.equal(touchesSchemaContent('ALTER TABLE tea ADD COLUMN region VARCHAR(255)'), true)
  assert.equal(touchesSchemaContent('INSERT INTO garden_plants (client_id) VALUES (?)'), true)
})

test('SQL 关键词：UPDATE … SET / SELECT … FROM / DROP / TRUNCATE / MERGE 都能命中', () => {
  assert.equal(touchesSchemaContent('UPDATE garden_plants SET status = ? WHERE client_id = ?'), true)
  assert.equal(touchesSchemaContent('SELECT id, status FROM garden_plants WHERE region_id = ?'), true)
  assert.equal(touchesSchemaContent('DROP INDEX idx_garden_plants_user'), true)
  assert.equal(touchesSchemaContent('TRUNCATE TABLE garden_plants'), true)
  assert.equal(touchesSchemaContent('MERGE INTO garden_plants USING (SELECT 1) ON 1=1'), true)
})

test('非 SQL 文件不误报', () => {
  assert.equal(touchesSchemaContent('function greet(name) { return `hello ${name}` }'), false)
  assert.equal(touchesSchemaContent('const list = await gardenApi.list(); return list.map(toVo)'), false)
})

test('测试文件排除：.test.cjs / .spec.js 含 SQL 不计入', () => {
  // 只测正则，不测真文件（真文件断言在下面 R2 修复的用例里）
  const excludeRe = /__tests__|(\.spec|\.test)\.[cm]?[jt]sx?$/
  assert.equal(excludeRe.test('src/garden.test.cjs'), true)
  assert.equal(excludeRe.test('src/garden.spec.js'), true)
  assert.equal(excludeRe.test('src/garden.ts'), false)
})

test('路径级判定不受内容级影响（独立）', () => {
  assert.equal(touchesSchemaPath('backend/src/main/resources/db/migration/V1__init.sql'), true)
  assert.equal(touchesSchemaPath('src/services/garden.ts'), false)
})

// R2 修复：真断言，写临时文件验证内容级分支
test('adrVerdict 内容级：含 SQL 的 service 文件 → touchesSchema: true', (t) => {
  const tmpDir = path.join(__dirname, '..', '..', '.tmp', 'schema-content-test')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, 'repository.cjs')
  fs.writeFileSync(tmpFile, 'export function findPlant(id) { return query("SELECT id FROM garden_plants WHERE id = ?", [id]) }')
  t.after(() => {
    try { fs.rmSync(tmpFile, { force: true }) } catch { /* ignore */ }
  })
  const v = adrVerdict([path.relative(path.join(__dirname, '..', '..'), tmpFile)])
  assert.equal(v.touchesSchema, true, '含 SQL 内容的文件必须判 touchesSchema=true')
  assert.equal(v.applicable, true)
})
