/** verify-controls.cjs — 检查 OrbitControls 状态 + 模拟拖拽是否改变相机 */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // 后端不在场时 telemetry 上报会刷 ERR_CONNECTION_REFUSED，污染错误桶：直接应答 204
  await page.route('**/v1/telemetry/batch', (r) => r.fulfill({ status: 204, body: '' }))
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  // 冷启动时 Vite 首次编译该路由 >4.5s，3D 未挂载就读 window.__teaGarden 会抛 TypeError（实测偶发）。
  // 改成等挂载完成再取，避免「探针自己崩」被读成「功能坏了」。
  await page
    .waitForFunction(() => !!window.__teaGarden, null, { timeout: 20000 })
    .catch(() => console.log('WARN: 20s 内未见 window.__teaGarden，后续断言可能为空'))
  await page.waitForTimeout(1500)

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
      hasListeners: c.domElement
        ? c.domElement._listeners
          ? Object.keys(c.domElement._listeners).length
          : 'n/a'
        : null,
    }
  })
  console.log('CONTROLS:', JSON.stringify(ctrl))

  // 2. 相机初始位置
  const camBefore = await page.evaluate(() => {
    const g = window.__teaGarden
    // 3D 未挂载时直接返回 null，让断言报红；不要在 evaluate 里抛 TypeError（那会变成 unhandled rejection）
    if (!g) return null
    const cam = g.activeCamera()
    const c = cam && cam.value ? cam.value : cam
    if (!c || !c.position) return null
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('CAM_BEFORE:', JSON.stringify(camBefore))

  // 3. 模拟拖拽（canvas 中央按下→移动→释放）
  await page.mouse.move(720, 450)
  await page.mouse.down()
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(720 + i * 12, 450 + i * 6)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)

  const camAfter = await page.evaluate(() => {
    const g = window.__teaGarden
    // 3D 未挂载时直接返回 null，让断言报红；不要在 evaluate 里抛 TypeError（那会变成 unhandled rejection）
    if (!g) return null
    const cam = g.activeCamera()
    const c = cam && cam.value ? cam.value : cam
    if (!c || !c.position) return null
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('CAM_AFTER:', JSON.stringify(camAfter))

  // 4. 滚轮缩放
  const zoomBefore = camAfter
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(500)
  const zoomAfter = await page.evaluate(() => {
    const g = window.__teaGarden
    // 3D 未挂载时直接返回 null，让断言报红；不要在 evaluate 里抛 TypeError（那会变成 unhandled rejection）
    if (!g) return null
    const cam = g.activeCamera()
    const c = cam && cam.value ? cam.value : cam
    if (!c || !c.position) return null
    return { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2) }
  })
  console.log('ZOOM_AFTER:', JSON.stringify(zoomAfter))

  // ---- 最小断言（本探针的价值就在这里：不判就等于只打印日志）----
  const moved = (a, b) => !!a && !!b && (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) > 0.01)
  if (!camBefore) errors.push('ASSERT: 3D 未挂载，相机读数缺失（window.__teaGarden 为空）')
  else if (!moved(camBefore, camAfter)) errors.push('ASSERT: 拖拽未改变相机位置（OrbitControls 可能失效）')
  if (!moved(camAfter, zoomAfter)) errors.push('ASSERT: 滚轮未改变相机位置（缩放可能失效）')
  // VERIFIED 行必须与断言结论一致：断了就是没验到，别让日志看起来像通过
  const assertsFailed = errors.some((e) => e.startsWith('ASSERT:'))
  console.log(
    'VERIFIED:',
    assertsFailed ? 'orbit-assert-failed（本次未通过）' : camBefore ? 'orbit-drag-and-zoom' : 'no-3d-scene（本次未验到控件）',
  )

  // 5. T4.1 起茶园降级为纯观赏：种植 / 点茶树 / 浇水的交互链路已从 src/ 删除
  //    （`.plant-btn-3d` 在 src/ 命中 0），原「浇水粒子」断言随之退役，不再假装覆盖。
  //    本探针只验 OrbitControls（旋转 / 缩放）与页面无报错。
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'verify_3d_controls.png' })
  console.log('ERRORS:', JSON.stringify(errors))
  if (errors.length > 0) process.exitCode = 1
  await browser.close()
})()
