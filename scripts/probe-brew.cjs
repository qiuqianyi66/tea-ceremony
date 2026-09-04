/**
 * probe-brew.cjs — 走到冲泡页并检查 3D canvas / 错误 / 主线程是否卡死。
 * 用法：node scripts/probe-brew.cjs [base]
 * base 默认 http://localhost:5173（vite dev）；可传 http://localhost:4173（preview）
 */
const { chromium } = require('@playwright/test')

;(async () => {
  const base = process.argv[2] || 'http://localhost:5173'
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(12000)
  const errs = []
  page.on('pageerror', e => errs.push('PE:' + (e.message || '').slice(0, 400)))
  page.on('console', m => {
    const t = m.text()
    if (m.type() === 'error') errs.push('CE:' + t.slice(0, 300))
    else if (t.includes('[3D-DEBUG]')) errs.push('LOG:' + t.slice(0, 300))
  })
  await page.route('**/api/ai/*', r => r.abort())
  await page.goto(base + '/')
  await page.waitForTimeout(5000)
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.waitForURL('**/tearoom')
  await page.getByRole('button', { name: '进入茶席' }).click({ timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: /直接选茶/ }).click()
  await page.waitForURL('**/select')
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page.getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ }).first().click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')
  console.log('BREW_OK')
  await page.waitForTimeout(3000)
  console.log('CANVAS:', await page.locator('canvas').count())
  console.log('H2:', JSON.stringify(await page.locator('h2').allTextContents()))
  // 检查所有 canvas（3D 与 tsParticles 并存，逐一探测）
  const px = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'))
    return cs.map((c, i) => {
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (!gl) return { i, cls: c.className.slice(0, 40), ctx: 'none' }
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight
      const buf = new Uint8Array(4)
      gl.readPixels(Math.floor(W / 2), Math.floor(H / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      return { i, cls: c.className.slice(0, 40), ctx: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1', size: W + 'x' + H, center: [buf[0], buf[1], buf[2], buf[3]] }
    })
  })
  console.log('CANVASES:', JSON.stringify(px))
  console.log('ERR:', JSON.stringify(errs, null, 1))
  await browser.close()
  process.exit(0)
})().catch(e => { console.error('FATAL', (e.message || '').slice(0, 400)); process.exit(1) })
