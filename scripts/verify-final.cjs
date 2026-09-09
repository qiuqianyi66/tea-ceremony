/** verify-final.cjs — 最终视觉验证：晴天全景（无云影/无发光片）→ 雨天全景（雨丝+云影隐藏） */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  // 晴天全景（相机默认位）
  await page.screenshot({ path: 'verify_final_sunny.png' })

  // 旋转视角看不同方向（确认无黑片/发光片）
  const hasControls = await page.evaluate(() => !!window.__teaGarden?.controls?.())
  if (hasControls) {
    // 右移视角
    await page.mouse.move(720, 450); await page.mouse.down()
    for (let i = 0; i < 15; i++) { await page.mouse.move(720 - i * 10, 450); await page.waitForTimeout(25) }
    await page.mouse.up(); await page.waitForTimeout(800)
    await page.screenshot({ path: 'verify_final_sunny2.png' })
  }

  // 切雨天
  const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
  if (await rainBtn.isVisible().catch(() => false)) {
    await rainBtn.click()
    await page.waitForTimeout(2800)
    await page.screenshot({ path: 'verify_final_rain.png' })
  }

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})()
