/** 四期验证：截图看视觉效果 + 点击交互回归 + 页面错误监控 */
const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message) })
  page.on('console', (m) => { if (m.type() === 'error') { errors.push('[console] ' + m.text().slice(0, 150)); console.log('[console.error]', m.text().slice(0, 150)) } })

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  // 截图（后处理 + 装饰效果）
  await page.screenshot({ path: 'verify_3d_phase4.png' })
  console.log('[1] 截图已保存 verify_3d_phase4.png')

  // 种 1 棵茶
  const plantBtn = page.locator('.plant-btn-3d')
  if (await plantBtn.isVisible().catch(() => false)) {
    await plantBtn.click()
    await page.waitForTimeout(500)
    await page.locator('.tea-select-item').first().click()
    await page.waitForTimeout(300)
    await page.locator('.dialog-btn.confirm').click()
    await page.waitForTimeout(6000)
  }

  // 全屏 raycast 定位 hitbox（按 userData.plantId 精确匹配，避免装饰 group 干扰）
  const scan = await page.evaluate(() => {
    const g = window.__teaGarden
    const scene = g.scene()
    const camera = g.activeCamera()
    const cam = camera.value || camera
    let hitbox = null
    scene.traverse((o) => { if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o })
    if (!hitbox) return { n: 0 }
    const rc = new g.THREE.Raycaster()
    const v = new g.THREE.Vector2()
    const hits = []
    for (let sy = 0; sy < 900; sy += 8) for (let sx = 0; sx < 1440; sx += 8) {
      v.x = (sx / 1440) * 2 - 1
      v.y = -(sy / 900) * 2 + 1
      rc.setFromCamera(v, cam)
      if (rc.intersectObject(hitbox, true).length > 0) hits.push([sx, sy])
    }
    if (!hits.length) return { n: 0 }
    return {
      n: hits.length,
      min: [Math.min(...hits.map((p) => p[0])), Math.min(...hits.map((p) => p[1]))],
      max: [Math.max(...hits.map((p) => p[0])), Math.max(...hits.map((p) => p[1]))],
    }
  })
  console.log('[2] hitbox 屏幕投影:', JSON.stringify(scan))

  // 区域内点击
  let hit = false
  if (scan.n) {
    const [minX, minY] = scan.min, [maxX, maxY] = scan.max
    for (let y = minY; y <= maxY && !hit; y += 12) {
      for (let x = minX; x <= maxX && !hit; x += 12) {
        await page.mouse.move(x, y)
        await page.waitForTimeout(60)
        await page.mouse.down()
        await page.waitForTimeout(60)
        await page.mouse.up()
        await page.waitForTimeout(250)
        if (await page.locator('.plant-detail').isVisible().catch(() => false)) {
          console.log(`[3] ✓ 点击 (${x},${y}) 弹出详情`)
          hit = true
          break
        }
      }
    }
  }
  console.log('[3] 交互结果:', hit ? '命中' : '未命中')
  if (hit) await page.screenshot({ path: 'verify_3d_click.png' })
  console.log(`[4] 页面错误: ${errors.length ? errors.join(' | ') : '无'}`)

  const pass = hit && errors.length === 0
  console.log(pass ? '\n=== ✅ 四期验证通过 ===' : '\n=== ❌ 验证未通过 ===')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('脚本失败:', e.message); process.exit(1) })
