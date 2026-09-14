/** brew 皮肤截图验证：走流程到 /brew，三套皮肤各截一张 */
const fs = require('fs')
const path = require('path')
;(async () => {
  const { chromium } = await import('playwright')
  const outDir = path.join(process.cwd(), '.tmp', 'brew_shots')
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  // 绕过 brew 页的 headless 门（webdriver / HeadlessChrome UA），让 3D 场景正常挂载
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page.getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ }).first().click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')
  await page.waitForTimeout(6000) // 等 3D 场景与火焰稳定（此间自动完成 煮水→温杯→醒茶）

  // 手验证：水温到 target 自动 WARMING → 0.8s 自动温杯 → RINSING 5s 醒茶倒计时。
  // 在 RINSING 窗口（注水动画与提壶手型仍在）抓「手在壶把位」，不等「温杯」按钮（已不可点）。
  await page.getByRole('button', { name: /醒茶中/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500) // 等手滑到壶把位
  await page.screenshot({ path: path.join(outDir, 'brew_hand_pour.png') })
  console.log('shot hand')

  const skins = [
    ['湖畔烟雨', 'lake-rain'],
    ['山顶日出', 'mountain-dawn'],
    ['室内雨夜', 'indoor-storm'],
  ]
  for (const [label, id] of skins) {
    await page.getByRole('button', { name: label }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `brew_${id}.png`) })
    console.log('shot', id)
  }

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
