/** 四期细节检查：种茶后无遮挡截图 + 茶树区域裁切 */
const { chromium } = require('@playwright/test')
const fs = require('fs')
const { PNG } = require('pngjs')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const plantBtn = page.locator('.plant-btn-3d')
  if (await plantBtn.isVisible().catch(() => false)) {
    await plantBtn.click()
    await page.waitForTimeout(500)
    await page.locator('.tea-select-item').first().click()
    await page.waitForTimeout(300)
    await page.locator('.dialog-btn.confirm').click()
    await page.waitForTimeout(6000)
  }

  // 定位茶树屏幕位置
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
    for (let sy = 0; sy < 900; sy += 6) for (let sx = 0; sx < 1440; sx += 6) {
      v.x = (sx / 1440) * 2 - 1
      v.y = -(sy / 900) * 2 + 1
      rc.setFromCamera(v, cam)
      if (rc.intersectObject(hitbox, true).length > 0) hits.push([sx, sy])
    }
    if (!hits.length) return null
    return {
      x: Math.round(hits.reduce((a, p) => a + p[0], 0) / hits.length),
      y: Math.round(hits.reduce((a, p) => a + p[1], 0) / hits.length),
    }
  })
  console.log('[1] 茶树屏幕中心:', JSON.stringify(scan))

  await page.screenshot({ path: 'verify_3d_phase4_planted.png' })
  console.log('[2] 种茶后截图已保存')

  // 裁切茶树区域（200x200）
  if (scan) {
    const png = PNG.sync.read(fs.readFileSync('verify_3d_phase4_planted.png'))
    const cx = Math.max(0, Math.min(png.width - 220, scan.x - 100))
    const cy = Math.max(0, Math.min(png.height - 220, scan.y - 100))
    const crop = new PNG({ width: 220, height: 220 })
    for (let y = 0; y < 220; y++) {
      for (let x = 0; x < 220; x++) {
        const si = ((cy + y) * png.width + (cx + x)) * 4
        const di = (y * 220 + x) * 4
        crop.data[di] = png.data[si]
        crop.data[di + 1] = png.data[si + 1]
        crop.data[di + 2] = png.data[si + 2]
        crop.data[di + 3] = png.data[si + 3]
      }
    }
    fs.writeFileSync('verify_3d_tea_crop.png', PNG.sync.write(crop))
    console.log(`[3] 茶树裁切已保存 (${cx},${cy})`)
  }
  await browser.close()
})().catch((e) => { console.error('脚本失败:', e.message); process.exit(1) })
