/**
 * 沉浸式茶山首页截图。
 * - home-desktop.png：桌面 1440x900
 * - home-mobile.png：移动端 390x844
 * - home-drawer.png：桌面端打开导航抽屉
 * 用法：node scripts/screenshot-home.cjs（需本地 dev :5174）
 */
const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const base = 'http://localhost:5174'

  // 桌面端
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 250)))
  await page.route('**/api/ai/*', route => route.abort())

  await page.goto(base + '/')
  await page.waitForTimeout(2200) // 等待入场动画 + 背景图加载
  await page.screenshot({ path: 'docs/screenshots/home-desktop.png' })

  // 抽屉打开
  await page.getByRole('button', { name: '打开菜单' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'docs/screenshots/home-drawer.png' })

  // 移动端
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const mpage = await mctx.newPage()
  await mpage.route('**/api/ai/*', route => route.abort())
  await mpage.goto(base + '/')
  await mpage.waitForTimeout(2200)
  await mpage.screenshot({ path: 'docs/screenshots/home-mobile.png' })

  await browser.close()
  console.log('home screenshots done')
})().catch(error => {
  console.error('SCREENSHOT_ERROR', error)
  process.exit(1)
})
