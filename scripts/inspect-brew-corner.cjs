/** 识别 brew 页左下角图标是什么元素 */
const fs = require('fs')
;(async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  const page = await ctx.newPage()
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
  await page.waitForTimeout(6000)

  // 左下角像素点元素
  const info = await page.evaluate(() => {
    const el = document.elementFromPoint(30, 870)
    if (!el) return 'none'
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName,
      cls: el.className?.toString().slice(0, 120),
      text: (el.textContent || '').trim().slice(0, 60),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    }
  })
  console.log('BOTTOM-LEFT ELEMENT:', JSON.stringify(info, null, 2))
  await page.screenshot({ path: '.tmp/brew_shots/inspect_bottomleft.png' })
  await browser.close()
})().catch(e => { console.error('FAIL', e); process.exit(1) })
