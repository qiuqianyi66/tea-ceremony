/**
 * 冲泡页 3D 场景截图（夜色暖光茶席）。
 * - brew-3d-heating.png：HEATING 阶段（炉火 + 蒸汽 + 夜色暖光）
 * - brew-3d-steeping.png：STEEPING 阶段（茶汤色 + 蒸汽）
 *
 * 用法：node scripts/screenshot-brew3d.cjs（需本地 preview :4173）
 * 注：截图脚本用非 headless UA + webdriver=false 绕过 headless 检测，以捕获真实 3D 效果。
 */
const { chromium } = require('@playwright/test')

;(async () => {
  const HEADED = process.env.HEADED === '1'
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: !HEADED,
    args: HEADED ? [] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  // 截图需要真实浏览器视角（挂载 3D）：用非 headless UA + webdriver=false 绕过 headless 检测
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1, // 1x 避免合成层黑帧
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })
  const page = await context.newPage()
  page.on('console', m => console.log(`[console.${m.type()}]`, m.text().slice(0, 250)))
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 250)))
  await page.route('**/api/ai/*', route => route.abort())
  const base = 'http://localhost:5173'

  // 首页：固定等待仪式感动画完成（#11 首页重做后「入席」直达 /select，不再经过 /tearoom）
  await page.goto(base + '/')
  await page.waitForTimeout(4600)
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.waitForURL('**/select')

  // 选茶：西湖龙井
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')

  // 选器：白瓷盖碗 + 山泉水（确认备器即开始煮水，进入 /brew 已是 HEATING）
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page.getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'docs/screenshots/brew-setup.png' })
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')
  await page.waitForTimeout(800)

  // HEATING：备器页已开始煮水，等待火焰/蒸汽升起
  await page.waitForTimeout(3200)
  await page.screenshot({ path: 'docs/screenshots/brew-3d-heating.png' })

  // 推进到 STEEPING（浸泡，茶汤色渐浓 + 入水/放茶/闷泡动画）
  await page.getByRole('button', { name: /温杯/ }).click()
  await page.getByRole('button', { name: /开始冲泡/ }).click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'docs/screenshots/brew-3d-steeping.png', timeout: 60000 })

  // DONE：等倒计时结束自动出汤（倒茶 + 喝茶动画）
  await page.waitForTimeout(15000)
  await page.screenshot({ path: 'docs/screenshots/brew-3d-done.png', timeout: 60000 })

  await browser.close()
  console.log('brew 3d screenshots done')
})().catch(error => {
  console.error('SCREENSHOT_ERROR', error)
  process.exit(1)
})
