/** 五期验证：浇水粒子动画 + 采摘功能闭环 */
const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message) })

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  // 1. 种一棵茶
  const plantBtn = page.locator('.plant-btn-3d')
  if (await plantBtn.isVisible().catch(() => false)) {
    await plantBtn.click()
    await page.waitForTimeout(500)
    await page.locator('.tea-select-item').first().click()
    await page.waitForTimeout(300)
    await page.locator('.dialog-btn.confirm').click()
    await page.waitForTimeout(6000)
  }
  console.log('[1] 种茶完成')

  // 2. 把茶树改成成熟期（IndexedDB 直接改 plantedAt 为 12 天前）
  await page.evaluate(async () => {
    const req = indexedDB.open('teaCeremonyDB')
    const db = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction('gardenPlants', 'readwrite')
    const store = tx.objectStore('gardenPlants')
    const plants = await new Promise((resolve) => {
      const r = store.getAll()
      r.onsuccess = () => resolve(r.result)
    })
    for (const p of plants) {
      const old = new Date(p.plantedAt).getTime()
      p.plantedAt = new Date(old - 12 * 86400000).toISOString()
      p.lastWateredAt = new Date(Date.now() - 2 * 86400000).toISOString()
      store.put(p)
    }
    await new Promise((resolve) => { tx.oncomplete = resolve })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  console.log('[2] 已改为成熟期并刷新')

  // 3. 定位茶树并点击打开详情
  const scan = await page.evaluate(() => {
    const g = window.__teaGarden
    const scene = g.scene()
    const camera = g.activeCamera()
    const cam = camera.value || camera
    let hitbox = null
    scene.traverse((o) => { if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o })
    if (!hitbox) return null
    const rc = new g.THREE.Raycaster()
    const v = new g.THREE.Vector2()
    const hits = []
    for (let sy = 0; sy < 900; sy += 8) for (let sx = 0; sx < 1440; sx += 8) {
      v.x = (sx / 1440) * 2 - 1
      v.y = -(sy / 900) * 2 + 1
      rc.setFromCamera(v, cam)
      if (rc.intersectObject(hitbox, true).length > 0) hits.push([sx, sy])
    }
    if (!hits.length) return null
    return { x: Math.round(hits.reduce((a, p) => a + p[0], 0) / hits.length), y: Math.round(hits.reduce((a, p) => a + p[1], 0) / hits.length) }
  })
  console.log('[3] 茶树位置:', JSON.stringify(scan))
  let opened = false
  if (scan) {
    for (let dy = -25; dy <= 25 && !opened; dy += 12) for (let dx = -25; dx <= 25 && !opened; dx += 12) {
      const x = Math.min(1435, Math.max(5, scan.x + dx)), y = Math.min(895, Math.max(5, scan.y + dy))
      await page.mouse.move(x, y); await page.waitForTimeout(60)
      await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(250)
      if (await page.locator('.plant-detail').isVisible().catch(() => false)) { opened = true; break }
    }
  }
  console.log('[4] 详情打开:', opened)

  // 4. 详情面板应有采摘按钮（成熟期）
  const harvestBtn = page.locator('.dialog-btn.harvest')
  const hasHarvest = await harvestBtn.isVisible().catch(() => false)
  const stageText = await page.locator('.detail-stage').innerText().catch(() => '')
  console.log(`[5] 成熟期详情: ${stageText}, 采摘按钮: ${hasHarvest}`)

  // 5. 点击采摘
  if (hasHarvest) {
    await harvestBtn.click()
    await page.waitForTimeout(1500)
    const stageAfter = await page.locator('.detail-stage').innerText().catch(() => '')
    const harvestCount = await page.evaluate(async () => {
      const req = indexedDB.open('teaCeremonyDB')
      const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
      const tx = db.transaction('gardenPlants', 'readonly')
      const store = tx.objectStore('gardenPlants')
      const plants = await new Promise((res) => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
      return plants[0]?.harvestCount ?? -1
    })
    console.log(`[6] 采摘后阶段: ${stageAfter}, harvestCount: ${harvestCount}`)
    await page.screenshot({ path: 'verify_3d_harvest.png' })
  }

  // 6. 浇水粒子：点浇水按钮（面板自动关闭），立即截图看粒子
  const waterBtn = page.locator('.dialog-btn.confirm')
  if (await waterBtn.isVisible().catch(() => false)) {
    await waterBtn.click()
    await page.waitForTimeout(450)
    const panelClosed = !(await page.locator('.plant-detail').isVisible().catch(() => false))
    await page.screenshot({ path: 'verify_3d_watering.png' })
    console.log(`[7] 浇水动画截图已保存，面板自动关闭: ${panelClosed}`)
    await page.waitForTimeout(1200)
    const cardWater = await page.locator('.plant-card .water-text').first().innerText().catch(() => '')
    console.log('[8] 浇水后底部卡片湿度:', cardWater)
  }

  console.log(`[9] 页面错误: ${errors.length ? errors.join(' | ') : '无'}`)
  const pass = opened && hasHarvest && errors.length === 0
  console.log(pass ? '\n=== ✅ 五期验证通过 ===' : '\n=== ❌ 验证未通过 ===')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('脚本失败:', e.message); process.exit(1) })

