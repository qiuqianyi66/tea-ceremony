/**
 * 茶园 3D 点击交互端到端验证（正式版）
 * 流程：种茶 → 全屏 Raycaster 扫描 hitbox 屏幕投影（确定性定位）→ 区域内点击 → 断言详情弹窗
 * 说明：TresJS+OrbitControls 的相机矩阵在渲染循环中与静态 camera.project() 存在系统性偏差
 *       （本场景实测 y 偏差约 450px），因此用"渲染同一相机做全屏 raycast"定位，
 *       不依赖投影数学、不依赖像素颜色（避免泥土/草地的颜色污染）。
 */
const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message) })

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  // 1. 种 1 棵茶
  const plantBtn = page.locator('.plant-btn-3d')
  if (await plantBtn.isVisible().catch(() => false)) {
    await plantBtn.click()
    await page.waitForTimeout(500)
    await page.locator('.tea-select-item').first().click()
    await page.waitForTimeout(300)
    await page.locator('.dialog-btn.confirm').click()
    await page.waitForTimeout(6000)
  }
  const cardCount = await page.locator('.plant-card').count().catch(() => 0)
  console.log(`[1] 已种茶，底部卡片数: ${cardCount}`)

  // 2. 全屏 raycast 扫描 hitbox（步长 8px，找到屏幕投影区域）
  const scan = await page.evaluate(() => {
    const g = window.__teaGarden
    const scene = g.scene()
    const camera = g.activeCamera()
    const cam = camera.value || camera
    const group = scene.children.find((c) => c.type === 'Group')
    const hitbox = group.children[group.children.length - 1]
    const rc = new g.THREE.Raycaster()
    const v = new g.THREE.Vector2()
    const hits = []
    for (let sy = 0; sy < 900; sy += 8) {
      for (let sx = 0; sx < 1440; sx += 8) {
        v.x = (sx / 1440) * 2 - 1
        v.y = -(sy / 900) * 2 + 1
        rc.setFromCamera(v, cam)
        if (rc.intersectObject(hitbox, true).length > 0) hits.push([sx, sy])
      }
    }
    if (!hits.length) return { n: 0 }
    return {
      n: hits.length,
      min: [Math.min(...hits.map((p) => p[0])), Math.min(...hits.map((p) => p[1]))],
      max: [Math.max(...hits.map((p) => p[0])), Math.max(...hits.map((p) => p[1]))],
    }
  })
  console.log('[2] hitbox 屏幕投影:', JSON.stringify(scan))
  if (!scan.n) {
    console.log('[x] 未找到茶树渲染位置（扫描零命中）')
    await browser.close()
    process.exit(1)
  }

  // 3. 在投影区域内点击
  const [minX, minY] = scan.min, [maxX, maxY] = scan.max
  let hit = false
  for (let y = minY; y <= maxY && !hit; y += 12) {
    for (let x = minX; x <= maxX && !hit; x += 12) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(60)
      await page.mouse.down()
      await page.waitForTimeout(60)
      await page.mouse.up()
      await page.waitForTimeout(250)
      if (await page.locator('.plant-detail').isVisible().catch(() => false)) {
        console.log(`[3] ✓ 点击 (${x},${y}) 弹出详情面板`)
        hit = true
        break
      }
    }
  }
  if (!hit) {
    console.log('[3] ✗ 区域内点击未弹出详情')
    await browser.close()
    process.exit(1)
  }

  // 4. 校验详情内容
  const text = await page.locator('.plant-detail').innerText().catch(() => '')
  const hasKeyInfo = /西湖龙井/.test(text) && /萌芽期/.test(text)
  console.log(`[4] 详情内容校验: ${hasKeyInfo ? '通过' : '失败'} ->`, text.replace(/\n/g, ' | ').slice(0, 140))
  await page.screenshot({ path: 'verify_3d_click.png' })
  console.log(`[5] 页面错误: ${errors.length ? errors.join(' | ') : '无'}`)

  const pass = hit && hasKeyInfo && errors.length === 0
  console.log(pass ? '\n=== ✅ 3D 点击交互验证通过 ===' : '\n=== ❌ 验证未通过 ===')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch((e) => { console.error('脚本失败:', e.message); process.exit(1) })
