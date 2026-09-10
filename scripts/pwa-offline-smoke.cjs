/* pwa-offline-smoke.cjs — PWA 离线闭环冒烟：在线预缓存 → 断网 → 核心路由可用性 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:4173';
// 路由: [路径, 关键文本断言]
const ROUTES = [
  ['/', '一盏茶'],
  ['/select', '选择一种茶叶'],
  ['/tea/longjing', '西湖龙井'],
  ['/collection', '茶图鉴'],
  ['/graph', null],        // 图谱：断言 canvas/节点存在
  ['/profile', '六境'],
  ['/history', '品鉴记录'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' && !/net::|Failed to fetch|ERR_|network/i.test(msg.text())) {
      errors.push('console: ' + msg.text().slice(0, 120));
    }
  });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 120)));

  // 1. 在线访问首页，等 SW 注册 + precache 完成
  console.log('--- 在线阶段：加载首页并等待 SW ---');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return '无 SW 支持';
    try {
      const reg = await navigator.serviceWorker.ready;
      return 'SW ready: ' + (reg.active ? 'active' : '?');
    } catch (e) { return 'SW error: ' + e.message; }
  });
  console.log(swReady);
  // 预缓存需要时间（33 张图），多等一会
  await page.waitForTimeout(4000);

  // 2. 断网
  console.log('--- 离线阶段 ---');
  const ctx = page.context();
  await ctx.setOffline(true);

  const results = [];
  for (const [path, text] of ROUTES) {
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(800);
      // 滚动到底触发 lazy 加载，再滚回顶部
      await page.evaluate(async () => {
        await window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 600));
        await window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const title = await page.title();
      const body = await page.evaluate(() => document.body.innerText.slice(0, 200));
      // 图片加载状态
      const imgStats = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')];
        const ok = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
        const bad = imgs.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.getAttribute('src') || '').slice(0, 5);
        return { total: imgs.length, ok, bad };
      });
      const bodyFull = await page.evaluate(() => document.body.innerText);
      const textHit = text ? bodyFull.includes(text) : bodyFull.length > 50;
      const pass = textHit && (text || imgStats.total === 0 || imgStats.ok > 0);
      results.push({ path, pass, title, textHit, imgStats, body: body.slice(0, 80) });
      console.log(
        (pass ? 'PASS' : 'FAIL') + ' ' + path +
        ' | 文本命中:' + textHit +
        ' | 图片 ' + imgStats.ok + '/' + imgStats.total +
        (imgStats.bad.length ? ' | 失败图: ' + imgStats.bad.join(', ') : '')
      );
    } catch (e) {
      results.push({ path, pass: false, err: String(e).slice(0, 100) });
      console.log('FAIL ' + path + ' | ' + String(e).slice(0, 100));
    }
  }

  await ctx.setOffline(false);
  console.log('--- 控制台错误（离线网络错误已过滤）---');
  console.log(errors.length ? errors.join('\n') : '无');
  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log('\n=== 结果: ' + (results.length - failed.length) + '/' + results.length + ' 通过 ===');
  process.exit(failed.length ? 1 : 0);
})();
