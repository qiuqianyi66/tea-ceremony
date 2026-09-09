/** verify-pavilion.cjs — v7：茶亭 (12,8) 交互验证 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  for (const region of ['hangzhou', 'wuyishan', 'yunnan', 'fuding']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.goto(`http://localhost:5173/garden/${region}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    const proj = await page.evaluate(() => {
      try {
        const g = window.__teaGarden;
        if (!g) return { error: 'no hook' }
        const camRef = g.activeCamera();
        const camera = (camRef && camRef.value) ? camRef.value : camRef;
        const v = new g.THREE.Vector3(12, 20, 8);
        const down = new g.THREE.Raycaster(new g.THREE.Vector3(12, 60, 8), new g.THREE.Vector3(0, -1, 0));
        let terrain = null;
        g.scene().traverse((o) => { if (o.isMesh && o.material && o.material.vertexColors === true) terrain = o });
        const dhits = down.intersectObject(terrain, true);
        const h = dhits.length ? dhits[0].point.y : 2;
        v.set(12, h + 2.4, 8);
        const projected = v.clone().project(camera);
        return { ndc: [projected.x, projected.y], h };
      } catch (e) { return { error: String(e && e.message || e) } }
    });
    if (!proj.ndc) { console.log(region, 'NO PROJ', JSON.stringify(proj)); await page.close(); continue }

    const box = await page.locator('.tea-garden-3d canvas').boundingBox();
    if (!box) { console.log(region, 'NO CANVAS'); await page.close(); continue }
    const cx = box.x + (proj.ndc[0] + 1) / 2 * box.width;
    const cy = box.y + (1 - (proj.ndc[1] + 1) / 2) * box.height;
    console.log(region, `PROJ ndc=(${proj.ndc[0].toFixed(2)},${proj.ndc[1].toFixed(2)}) h=${proj.h.toFixed(1)} Click=(${cx.toFixed(0)},${cy.toFixed(0)})`);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(1500);

    const panelVisible = await page.locator('.pavilion-panel').isVisible().catch(() => false);
    console.log(region, 'Pavilion visible:', panelVisible);
    if (panelVisible) {
      const quote = await page.locator('.pavilion-quote').textContent();
      const source = await page.locator('.pavilion-source').textContent();
      console.log(region, 'QUOTE:', quote?.trim());
      console.log(region, 'SOURCE:', source?.trim());
      await page.screenshot({ path: `verify_pavilion_${region}.png` });
    }
    console.log(region, 'ERRORS:', JSON.stringify(errors));
    await page.close();
  }
  await browser.close();
})()
