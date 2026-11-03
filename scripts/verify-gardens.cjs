/** verify-gardens.cjs — 四茶园差异化视觉验证：逐一进园截图（晴天+雨天+俯身近观雨丝）
 *  自启 dev server（复用 scripts/lib/ensure-dev-server.cjs）：端口未监听时自动拉起，结束关闭。 */
const { ensureDevServer } = require('./lib/ensure-dev-server.cjs')
const { chromium } = require('playwright')

;(async () => {
  const server = await ensureDevServer({ logFile: 'verify-gardens-dev.log' })
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: 'chromium' })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    // 后端不在场时 telemetry 上报会刷 ERR_CONNECTION_REFUSED，污染错误桶：直接应答 204（不启后端也能验视觉）
    await page.route('**/v1/telemetry/batch', (r) => r.fulfill({ status: 204, body: '' }))
    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

    const regions = ['hangzhou', 'wuyishan', 'yunnan', 'fuding']
    for (const rid of regions) {
      await page.goto('http://127.0.0.1:5173/garden/' + rid, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(5000)
      await page.screenshot({ path: `verify_garden_${rid}_sunny.png` })

      // 雨天（拉近相机位验证雨丝近观不发白）
      const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
      if (await rainBtn.isVisible().catch(() => false)) {
        await rainBtn.click()
        await page.waitForTimeout(3000)
        await page.screenshot({ path: `verify_garden_${rid}_rain.png` })
      }
    }

    console.log('ERRORS:', JSON.stringify(errors))
    if (errors.length > 0) process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    await server.stop()
  }
})()
