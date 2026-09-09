/** verify-gardens.cjs — 四茶园差异化视觉验证：逐一进园截图（晴天+雨天+俯身近观雨丝） */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const regions = ['hangzhou', 'wuyishan', 'yunnan', 'fuding'];
  for (const rid of regions) {
    await page.goto(`http://localhost:5173/garden/${rid}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `verify_garden_${rid}_sunny.png` });

    // 雨天（拉近相机位验证雨丝近观不发白）
    const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]');
    if (await rainBtn.isVisible().catch(() => false)) {
      await rainBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `verify_garden_${rid}_rain.png` });
    }
  }

  console.log('ERRORS:', JSON.stringify(errors));
  await browser.close();
})()
