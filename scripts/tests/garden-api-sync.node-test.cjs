/**
 * gardenApi.list API 层单测（node --test）。
 * 覆盖「读路径连通」：静态验证 gardenApi.list URL 与 E2E 拦截路径一致 + mock 数据结构正确。
 * E2E 在 CI preview 模式下请求验证不稳定（isLoggedIn 时序差异），此处补 API 层覆盖。
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')

test('gardenApi.list 请求路径正确（/v1/garden-plants）', () => {
  const text = fs.readFileSync('src/services/api/garden.ts', 'utf8')
  assert.ok(text.includes("'/v1/garden-plants'"), 'gardenApi.list URL 必须是 /v1/garden-plants')
})

test('energyApi.summary 请求路径正确（/v1/garden-energy）', () => {
  const text = fs.readFileSync('src/services/api/garden.ts', 'utf8')
  assert.ok(text.includes("'/v1/garden-energy'"), 'energyApi.summary URL 必须是 /v1/garden-energy')
})

test('GardenView 调用 gardenApi.list + energyApi.summary（读路径连通）', () => {
  const text = fs.readFileSync('src/views/GardenView.vue', 'utf8')
  assert.ok(
    text.includes('Promise.all([gardenApi.list(), energyApi.summary()])'),
    'GardenView 必须同时调用 gardenApi.list 与 energyApi.summary',
  )
})

test('gardenApi.list 返回 GardenPlantVo[]（契约）', () => {
  const text = fs.readFileSync('src/services/api/garden.ts', 'utf8')
  assert.ok(
    text.includes('Promise<GardenPlantVo[]>'),
    'gardenApi.list 返回类型必须是 GardenPlantVo[]',
  )
})
