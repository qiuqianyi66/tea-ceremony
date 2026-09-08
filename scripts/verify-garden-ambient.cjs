/**
 * verify-garden-ambient.cjs — 活茶园氛围层验证
 * 1. 打开茶园页（登录态 + 3 棵茶）
 * 2. 截晴天全景（云朵/云影/晨雾/动物可见）
 * 3. 点"雨天"按钮 → 等待渐变 → 截雨天（雨丝 + 湿润 + 光变暗 + 雾浓）
 * 4. 点音效按钮 → 检查无页面错误
 */
const { chromium } = require('playwright');
const fs = require('fs');

const ORIGIN = 'http://localhost:5173';
const OUT = 'verify_3d_ambient.png';
const OUT_RAIN = 'verify_3d_rain.png';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // 游客可直接访问茶园页
  await page.goto(ORIGIN + '/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 若无茶树则种 3 棵（empty-hint 存在才种）
  if ((await page.locator('.empty-hint').count()) > 0) {
    for (let i = 0; i < 3; i++) {
      await page.click('.plant-btn-3d');
      await page.waitForTimeout(400);
      const items = page.locator('.tea-select-item');
      if ((await items.count()) > 0) await items.first().click();
      await page.waitForTimeout(300);
      await page.click('.dialog-btn.confirm');
      await page.waitForTimeout(2500); // 等 loadPlants + 3D 叶簇重建
    }
  }

  // 等 3D 场景加载 + 动画走几秒（云/动物/雾动起来）
  await page.waitForTimeout(4000);
  await page.screenshot({ path: OUT });
  console.log('[1] 晴天全景已截图');

  // 切换雨天（按钮 title 在晴天时为"切换到雨天"）
  await page.click('.ambient-btn-3d[title="切换到雨天"]');
  await page.waitForTimeout(3200); // 渐变 1.6s + 余量
  await page.screenshot({ path: OUT_RAIN });
  console.log('[2] 雨天已截图');

  // 音效开关（无断言，仅确认不报错）
  await page.click('.ambient-btn-3d[title="开启环境音"]');
  await page.waitForTimeout(800);
  await page.click('.ambient-btn-3d[title="关闭环境音"]');
  await page.waitForTimeout(500);

  // 切回晴天，避免遗留
  await page.click('.ambient-btn-3d[title="切换到晴天"]');
  await page.waitForTimeout(2200);

  console.log('[3] 音效开关操作完成');
  console.log('页面错误数: ' + errors.length);
  if (errors.length > 0) console.log(errors.slice(0, 5).join('\n'));
  await browser.close();
})();
