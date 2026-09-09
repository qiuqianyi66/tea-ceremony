/** verify-controls.cjs — 检查 OrbitControls 状态 + 模拟拖拽是否改变相机 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  // 1. controls 状态
  const ctrl = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const c = g.controls()
    if (!c) return { found: false }
    return {
      found: true,
      enableRotate: c.enableRotate,
      enablePan: c.enablePan,
      enableZoom: c.enableZoom,
      enabled: c.enabled,
      domElement: !!c.domElement,
      hasListeners: c.domElement ? (c.domElement._listeners ? Object.keys(c.domElement._listeners).length : 'n/a') : null,
    }
  })
  console.log('CONTROLS:', JSON.stringify(ctrl))

  // 2. 相机初始位置
  const camBefore = await page.evaluate(() => {
    const g = window.__teaGarden
    const cam = g.activeCamera(); const c = cam && cam.value ? cam.value : cam
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('CAM_BEFORE:', JSON.stringify(camBefore))

  // 3. 模拟拖拽（canvas 中央按下→移动→释放）
  await page.mouse.move(720, 450)
  await page.mouse.down()
  for (let i = 0; i < 10; i++) { await page.mouse.move(720 + i * 12, 450 + i * 6); await page.waitForTimeout(30) }
  await page.mouse.up()
  await page.waitForTimeout(600)

  const camAfter = await page.evaluate(() => {
    const g = window.__teaGarden
    const cam = g.activeCamera(); const c = cam && cam.value ? cam.value : cam
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('CAM_AFTER:', JSON.stringify(camAfter))

  // 4. 滚轮缩放
  const zoomBefore = camAfter
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(500)
  const zoomAfter = await page.evaluate(() => {
    const g = window.__teaGarden
    const cam = g.activeCamera(); const c = cam && cam.value ? cam.value : cam
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('ZOOM_AFTER:', JSON.stringify(zoomAfter))

  // 5. 浇水动画验证（种茶→点茶树→浇水→查粒子）
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
  const hit = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const scene = g.scene()
    let hitbox = null
    scene.traverse((o) => { if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o })
    if (!hitbox) return null
    const cam = g.activeCamera(); const c = cam && cam.value ? cam.value : cam
    const v = hitbox.getWorldPosition(new (g.THREE.Vector3)())
    const p = v.clone().project(c)
    return { x: (p.x * 0.5 + 0.5) * 1440, y: (-p.y * 0.5 + 0.5) * 900 }
  })
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1200) }
  const wb = await page.locator('.dialog-btn', { hasText: '浇水' }).last().boundingBox().catch(() => null)
  let waterState = null
  if (wb) {
    await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2)
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
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'verify_3d_controls_water.png' })

  console.log('WATER:', JSON.stringify({ wbFound: !!wb, waterState }))
  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})()
