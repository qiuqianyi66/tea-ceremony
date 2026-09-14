/**
 * brew 移动端验证：390×844（iPhone 14 视口）走完整流程
 * - 触控断言：主按钮 + 皮肤按钮 ≥ 44×44
 * - 溢出断言：无横向滚动
 * - 截图：RINSING 手型（验证竖屏 3D 桌面不被裁）+ 三套皮肤
 * 用法：node scripts/verify-brew-mobile.cjs（需本地 dev server :5173）
 */
const fs = require('fs')
const path = require('path')
;(async () => {
  const { chromium } = await import('playwright')
  const outDir = path.join(process.cwd(), '.tmp', 'brew_shots')
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  // 绕过 brew 页的 headless 门（webdriver / HeadlessChrome UA），让 3D 场景正常挂载
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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

  // ===== 截图：RINSING 手型（确定性等待，验证竖屏下桌面/壶不被裁）=====
  await page.getByRole('button', { name: /醒茶中/ }).waitFor({ timeout: 25000 })
  await page.waitForTimeout(400) // 等手滑到壶把位
  await page.screenshot({ path: path.join(outDir, 'mobile_hand_pour.png') })
  console.log('shot mobile hand')

  // 等自动 READY，再统一做尺寸断言（避免加热快慢导致落到 HEATING 的「62°C」按钮）
  await page.getByRole('button', { name: /开始冲泡/ }).waitFor({ timeout: 25000 })

  // ===== 触控目标断言：主按钮 + 注水壶嘴 + 皮肤按钮 ≥ 44×44 =====
  const focusNames = /开始冲泡|出汤|湖畔烟雨|山顶日出|室内雨夜|◒/
  const sizes = []
  for (const btn of await page.getByRole('button').all()) {
    if (!(await btn.isVisible())) continue
    const text = (await btn.innerText()) || ''
    if (!focusNames.test(text)) continue
    const box = await btn.boundingBox()
    if (box) sizes.push({ name: text.slice(0, 16), w: Math.round(box.width), h: Math.round(box.height) })
  }
  console.log('TOUCH_SIZES', JSON.stringify(sizes))
  for (const s of sizes) {
    if (s.w < 44 || s.h < 44) errors.push(`touch target undersized: ${s.name} ${s.w}x${s.h}`)
  }

  // ===== 无横向滚动断言 =====
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  })
  console.log('SCROLL', JSON.stringify(overflow))
  if (overflow.scrollWidth > overflow.clientWidth) {
    errors.push(`horizontal overflow: ${overflow.scrollWidth} > ${overflow.clientWidth}`)
  }

  // ===== 截图：三套皮肤 =====
  const skins = [
    ['湖畔烟雨', 'lake-rain'],
    ['山顶日出', 'mountain-dawn'],
    ['室内雨夜', 'indoor-storm'],
  ]
  for (const [label, id] of skins) {
    await page.getByRole('button', { name: label }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(outDir, `mobile_${id}.png`) })
    console.log('shot mobile', id)
  }

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
