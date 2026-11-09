/**
 * brew 桌面端验证：1440×900 走完整流程，截三套皮肤的 3D 茶席。
 * - 断言：无横向滚动
 * - 用途：手机视口（scripts/verify-brew-mobile.cjs）覆盖不到的宽屏构图/相机 fov 分支
 * 用法：node scripts/verify-brew-desktop.cjs（需本地 dev server :5173）
 *
 * 注意：必须显式给一个不含 HeadlessChrome 的桌面 UA。Playwright 默认 UA 带
 * HeadlessChrome，会被 BrewView 的 isHeadless 门判成无 GPU 而回退 CSS 插画，
 * 结果截到的是假 3D（canvas 0×0）。
 */
const fs = require('fs')
const path = require('path')
;(async () => {
  const { chromium } = await import('playwright')
  const outDir = path.join(process.cwd(), '.tmp', 'brew_shots')
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page
    .getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ })
    .first()
    .click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')

  await page.getByRole('button', { name: /醒茶中/ }).waitFor({ timeout: 25000 })
  await page.getByRole('button', { name: /开始冲泡/ }).waitFor({ timeout: 25000 })

  // 3D 真挂上的硬证据：canvas 必须铺满视口，否则说明被 headless 门回退了
  const canvasBox = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  console.log('CANVAS', JSON.stringify(canvasBox))
  if (!canvasBox || canvasBox.w < 1000) {
    errors.push(`3D canvas not mounted: ${JSON.stringify(canvasBox)}`)
  }

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  console.log('SCROLL', JSON.stringify(overflow))
  if (overflow.scrollWidth > overflow.clientWidth) {
    errors.push(`horizontal overflow: ${overflow.scrollWidth} > ${overflow.clientWidth}`)
  }

  const skins = [
    ['湖畔烟雨', 'lake-rain'],
    ['山顶日出', 'mountain-dawn'],
    ['室内雨夜', 'indoor-storm'],
  ]
  for (const [label, id] of skins) {
    await page.getByRole('button', { name: label }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `desktop_${id}.png`) })
    console.log('shot desktop', id)
  }

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
