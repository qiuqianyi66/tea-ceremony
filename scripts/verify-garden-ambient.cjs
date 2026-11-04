/**
 * verify-garden-ambient.cjs — 活茶园氛围层验证
 * 1. 打开茶园页（登录态 + 3 棵茶）
 * 2. 截晴天全景（云朵/云影/晨雾/动物可见）
 * 3. 点"雨天"按钮 → 等待渐变 → 截雨天（雨丝 + 湿润 + 光变暗 + 雾浓）
 * 4. 点音效按钮 → 检查无页面错误
 */
const { chromium } = require('playwright')
const fs = require('fs')

const ORIGIN = 'http://localhost:5173'
const OUT = 'verify_3d_ambient.png'
const OUT_RAIN = 'verify_3d_rain.png'

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // 后端不在场时 telemetry 上报会刷 ERR_CONNECTION_REFUSED，污染错误桶：直接应答 204
  await page.route('**/v1/telemetry/batch', (r) => r.fulfill({ status: 204, body: '' }))
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  })

  // 游客可直接访问茶园页
  await page.goto(ORIGIN + '/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  // T4.1 起茶园降级为纯观赏：种植 / 浇水 / 修剪 / 采摘链路已由产品删除（见 src/views/GardenView.vue 头注释）。
  // 旧版此处「若无苗则种 3 棵」的播种分支引用 `.plant-btn-3d`（全仓 src/ 命中 0）与 `.empty-hint`
  // （仅存于 SelectView.vue / TeaDragDrop.vue，茶园页无此节点），分支永远不执行，已删除。
  // 本探针只验氛围层（云影 / 雾 / 雨丝 / 音效），不再假装覆盖养成链路。
  await page.waitForTimeout(4000)
  await page.screenshot({ path: OUT })
  console.log('[1] 晴天全景已截图')

  // 切换雨天（按钮 title 在晴天时为"切换到雨天"）
  await page.click('.ambient-btn-3d[title="切换到雨天"]')
  await page.waitForTimeout(3200) // 渐变 1.6s + 余量
  await page.screenshot({ path: OUT_RAIN })
  console.log('[2] 雨天已截图')

  // 音效开关（无断言，仅确认不报错）
  await page.click('.ambient-btn-3d[title="开启环境音"]')
  await page.waitForTimeout(800)
  await page.click('.ambient-btn-3d[title="关闭环境音"]')
  await page.waitForTimeout(500)

  // 切回晴天，避免遗留
  await page.click('.ambient-btn-3d[title="切换到晴天"]')
  await page.waitForTimeout(2200)

  console.log('[3] 音效开关操作完成')
  console.log('页面错误数: ' + errors.length)
  if (errors.length > 0) console.log(errors.slice(0, 5).join('\n'))
  // 本探针只断言「氛围层按钮可点且操作过程中页面无报错」，不校验截图内容，也不覆盖 telemetry 传输正确性
  // （#207 起 telemetry batch 被拦成 204，传输/退避链路在本探针中不可见）；
  // 浇水/种植粒子动画不在覆盖范围——该链路已由 T4.1 从产品删除，不再有任何探针声称覆盖它。
  console.log('VERIFIED: page-error-free + ambient-buttons-clickable（视觉内容、telemetry 传输、已删除的养成链路均不在覆盖范围）')
  console.log('ERRORS:', JSON.stringify(errors))
  if (errors.length > 0) process.exitCode = 1
  await browser.close()
})()
