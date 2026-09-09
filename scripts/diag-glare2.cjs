/** diag-glare2.cjs — 环境强度 0 / 换 sky env 对比 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  // 1. environmentIntensity = 0
  await page.evaluate(() => { window.__teaGarden.scene().environmentIntensity = 0 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'diag2_0_env0.png' })

  // 2. 恢复 0.45，把 environment 换成纯天空色
  await page.evaluate(() => {
    const g = window.__teaGarden
    g.scene().environmentIntensity = 0.45
    g.scene().environment = new g.THREE.Color(0xbfd4e6)
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'diag2_1_color_env.png' })

  await browser.close()
  console.log('done')
})()
