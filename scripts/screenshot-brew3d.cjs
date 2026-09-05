/**
 * 冲泡页 3D 场景截图（夜色暖光茶席）。
 * - brew-3d-heating.png：HEATING 阶段（炉火 + 蒸汽 + 夜色暖光）
 * - brew-3d-steeping.png：STEEPING 阶段（茶汤色 + 蒸汽）
 *
 * 用法：node scripts/screenshot-brew3d.cjs（需本地 preview :4173）
 */
const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium' })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1, // 1x 避免合成层黑帧
  })
  await page.route('**/api/ai/*', route => route.abort())
  const base = 'http://localhost:4173'

  // 首页：固定等待仪式感动画完成
  await page.goto(base + '/')
  await page.waitForTimeout(4600)
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.waitForURL('**/tearoom')

  // 入席 → 直接选茶
  await page.getByRole('button', { name: '进入茶席' }).click({ timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: /直接选茶/ }).click()
  await page.waitForURL('**/select')

  // 选茶：西湖龙井
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')

  // 选器：白瓷盖碗 + 山泉水
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page.getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ }).first().click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')
  await page.waitForTimeout(800)

  // HEATING：开始煮水，等火焰升起
  await page.getByRole('button', { name: '开始煮水' }).click()
  await page.waitForTimeout(3200)
  await page.screenshot({ path: 'docs/screenshots/brew-3d-heating.png' })

  // 推进到 STEEPING（浸泡，茶汤色渐浓）
  await page.getByRole('button', { name: /温杯/ }).click()
  await page.getByRole('button', { name: /开始冲泡/ }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'docs/screenshots/brew-3d-steeping.png' })

  await browser.close()
  console.log('brew 3d screenshots done')
})().catch(error => {
  console.error('SCREENSHOT_ERROR', error)
  process.exit(1)
})
