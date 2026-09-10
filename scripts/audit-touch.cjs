/** audit-touch.cjs — 触控目标 ≥ 44px 抽查（移动视口 390x844）
 *  豁免清单（设计意图，非违规）：Hero 区轻量文字链接（brand/enter-link/flow-more/tea-share/换一首/换一位）；
 *  返回类文本按钮高已 44px，宽为文字自然宽。 */
const { chromium } = require('@playwright/test');

const ROUTES = ['/', '/select', '/history', '/profile', '/tea/longjing', '/share', '/map', '/health'];

(async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const violations = [];

  for (const route of ROUTES) {
    await page.goto(`http://localhost:5173${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const items = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a, [role="button"], input[type="submit"], [tabindex]:not([tabindex="-1"])')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const visible = getComputedStyle(el).visibility !== 'hidden' && el.offsetParent !== null;
        if (!visible) continue;
        if (r.width < 44 || r.height < 44) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 50),
            text: (el.textContent || '').trim().slice(0, 20),
            w: Math.round(r.width), h: Math.round(r.height),
          });
        }
      }
      return out;
    });
    for (const it of items) violations.push({ route, ...it });
  }

  console.log('--- 触控目标 < 44px 违规 ---');
  for (const v of violations) console.log(`${v.route}  ${v.tag} ${v.w}x${v.h}  "${v.text}"  [${v.cls}]`);
  console.log(`共 ${violations.length} 处`);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
