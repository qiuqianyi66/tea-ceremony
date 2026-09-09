/** verify-water2.cjs — 坐标点击浇水，检查粒子状态 + 截图 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const plantBtn = page.locator('.plant-btn-3d')
  const empty = await page.locator('.empty-hint').isVisible().catch(() => false)
  if (empty) {
    await plantBtn.click(); await page.waitForTimeout(400)
    const items = page.locator('.tea-select-item')
    if (await items.count() > 0) { await items.first().click(); await page.waitForTimeout(300) }
    const confirm = page.locator('.dialog-btn.confirm')
    if (await confirm.isVisible().catch(() => false)) { await confirm.click() }
    await page.waitForTimeout(2500)
  }

  // 点击茶树打开详情
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

  // 找到浇水按钮（按可见文本），点它
  const waterBtn = page.locator('.dialog-btn', { hasText: '浇水' }).last()
  const wb = waterBtn.boundingBox().catch(() => null)
  let waterState = null
  if (wb) {
    const box = await wb
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    // 立即检查粒子状态（30ms 内应有粒子 visible + y 在下落）
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(150)
      waterState = await page.evaluate(() => {
        const g = window.__teaGarden
        if (!g) return null
        const scene = g.scene()
        let pts = null
        scene.traverse((o) => { if (o.type === 'Points' && o.geometry && o.geometry.attributes.position) pts = o })
        if (!pts) return { found: false }
        const pos = pts.geometry.attributes.position
        const ys = []
        for (let i = 0; i < Math.min(pos.count, 5); i++) ys.push(+(pos.getY(i)).toFixed(2))
        return { found: true, visible: pts.visible, count: pos.count, sampleYs: ys }
      })
      if (waterState && waterState.visible) break
    }
  }
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'verify_3d_watering4.png' })

  // 切雨天验证
  const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
  if (await rainBtn.isVisible().catch(() => false)) {
    await rainBtn.click()
    await page.waitForTimeout(2600)
    await page.screenshot({ path: 'verify_3d_rain3.png' })
  }

  console.log(JSON.stringify({ waterBtnFound: !!wb, waterState, errors }, null, 2))
  await browser.close()
})()
