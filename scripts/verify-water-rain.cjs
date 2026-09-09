/** verify-water-rain.cjs — 复现用户操作：种茶→点击茶树→浇水动画；切雨天→雨丝；捕获 console 错误 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 1. 种茶（若无苗）
  const plantBtn = page.locator('.plant-btn-3d')
  const empty = await page.locator('.empty-hint').isVisible().catch(() => false)
  if (empty) {
    await plantBtn.click()
    await page.waitForTimeout(400)
    const items = page.locator('.tea-select-item')
    if (await items.count() > 0) { await items.first().click(); await page.waitForTimeout(300) }
    const confirm = page.locator('.dialog-btn.confirm')
    if (await confirm.isVisible().catch(() => false)) { await confirm.click() }
    await page.waitForTimeout(2500)
  }

  // 2. 点击茶树 hitbox 打开详情面板
  const hit = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const scene = g.scene()
    let hitbox = null
    scene.traverse((o) => { if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o })
    if (!hitbox) return null
    const cam = (() => { const a = g.activeCamera(); return a && a.value ? a.value : a })()
    const v = hitbox.getWorldPosition(new (g.THREE.Vector3)())
    const p = v.clone().project(cam)
    return { x: (p.x * 0.5 + 0.5) * 1440, y: (-p.y * 0.5 + 0.5) * 900 }
  })
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1200) }

  // 3. 点"浇水"
  const waterBtn = page.locator('.dialog-btn.confirm', { hasText: '浇水' })
  if (await waterBtn.isVisible().catch(() => false)) {
    await waterBtn.click()
    await page.waitForTimeout(450)
    await page.screenshot({ path: 'verify_3d_watering2.png' })
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'verify_3d_watering3.png' })
    // 关闭面板
    const close = page.locator('.dialog-btn.cancel', { hasText: '关闭' })
    if (await close.isVisible().catch(() => false)) await close.click()
    await page.waitForTimeout(400)
  }

  // 4. 切雨天 → 截图（1.6s 渐变后）
  const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
  if (await rainBtn.isVisible().catch(() => false)) {
    await rainBtn.click()
    await page.waitForTimeout(2600)
    await page.screenshot({ path: 'verify_3d_rain2.png' })
  }

  console.log(JSON.stringify({ wateringVisible: await waterBtn.isVisible().catch(() => false), errors }, null, 2))
  await browser.close()
})()
