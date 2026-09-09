/** verify-field.cjs — 古籍茶园验证：新地形（山脊/红壤/梯田/排水）+ 成垄茶行 + 遮阴树 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // 茶行数量统计
  const fieldStats = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const tf = g.scene().getObjectByName('tea-field')
    if (!tf) return { found: false }
    let bushes = 0, trunks = 0, trees = 0
    tf.traverse((o) => {
      if (o.isInstancedMesh) {
        if (o.geometry.type === 'SphereGeometry') bushes = o.count
        if (o.geometry.type === 'CylinderGeometry') trunks = o.count
      }
      if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && !o.isInstancedMesh) trees++
    })
    return { found: true, bushes, trunks, shadeTrees: trees }
  })
  console.log('FIELD:', JSON.stringify(fieldStats))

  // 相机默认位全景
  await page.screenshot({ path: 'verify_field_sunny.png' })

  // 拉近看茶行（相机转向茶园带：茶行在 z -26~-41）
  await page.evaluate(() => {
    const g = window.__teaGarden
    const cam = g.activeCamera(); const c = cam && cam.value ? cam.value : cam
    c.position.set(0, 14, -50)
    c.lookAt(0, 5, -30)
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'verify_field_rows.png' })

  // 种一棵用户茶树（交互闭环保留验证）
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
  await page.screenshot({ path: 'verify_field_planted.png' })

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})()
