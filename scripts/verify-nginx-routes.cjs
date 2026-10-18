#!/usr/bin/env node
/**
 * nginx 路由白名单 ↔ 前端路由表 双向核对。
 *
 * 背景：nginx 用「已知路由白名单 + SPA fallback + 其余 404」防止
 * 任意路径（含 /.env、/.git/config 探测）被回成 200 HTML（软 404）。
 * 代价是白名单会漂移：新增/删除前端路由而忘记改 nginx，线上表现是
 * **该路由 404、整站页面打不开**，且本地 dev（vite）完全正常，排查困难。
 *
 * 本脚本把这条约定机械化：
 *   src/router/index.ts 的顶层路径段  ==  nginx 白名单（去重、排序后比较）
 *
 * 2026-10-18 起 location 段搬到 nginx/snippets/app-locations.conf（80/443 共用的单一来源），
 * 所以白名单从主配置 + 该片段里合并查找；同时校验片段确实被 443 server include
 * （否则片段存在但没人引用 = 线上根本没生效，比漂移更隐蔽）。
 *
 * 用法：node scripts/verify-nginx-routes.cjs
 * 期望输出 ERRORS: []；有缺口 exit 1。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'src/router/index.ts');
const NGINX = path.join(ROOT, 'nginx.conf');
const APP_LOCATIONS = path.join(ROOT, 'nginx/snippets/app-locations.conf');

/** 顶级路径段 → 需要 nginx 放行的名字。`/` 与动态段（:id）不产生顶层段。 */
function topSegments(routes) {
  const out = new Set();
  for (const r of routes) {
    const seg = r.split('/').filter(Boolean)[0];
    // 动态首段（/:id）无法白名单化，视为配置错误
    if (!seg || seg.startsWith(':')) continue;
    out.add(seg);
  }
  return out;
}

/** 去掉整行注释，避免注释里的示例 location 干扰判断 */
function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function main() {
  const errors = [];
  const routerSrc = fs.readFileSync(ROUTER, 'utf8');
  const activeMain = stripComments(fs.readFileSync(NGINX, 'utf8'));

  if (!fs.existsSync(APP_LOCATIONS)) {
    console.log('ERRORS: ["nginx/snippets/app-locations.conf 不存在（location 段的单一来源）"]');
    process.exit(1);
  }
  const activeSnippet = stripComments(fs.readFileSync(APP_LOCATIONS, 'utf8'));
  const combined = `${activeMain}\n${activeSnippet}`;

  // 只取 router 里 path: '...' 的字面量（本项目路由表全部为字面量）
  const routePaths = [...routerSrc.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
  if (routePaths.length === 0) {
    console.log('ERRORS: ["src/router/index.ts 未解析到任何 path，检查路由定义写法"]');
    process.exit(1);
  }

  const routeSegs = topSegments(routePaths);

  // nginx 白名单：形如 location ~ ^/(a|b|c)(/|$)
  const wlMatch = combined.match(/location\s+~\s+\^\/\(([^)]+)\)\(\/\|\$\)/);
  if (!wlMatch) {
    console.log('ERRORS: ["nginx 配置（含 snippets/app-locations.conf）未找到 SPA 路由白名单 location"]');
    process.exit(1);
  }
  const nginxSegs = new Set(wlMatch[1].split('|').map((s) => s.trim()).filter(Boolean));

  // 片段必须真的被某个 server include，否则白名单是死配置
  if (!/include\s+\S*snippets\/app-locations\.conf/.test(activeMain)) {
    errors.push('nginx.conf 没有 include snippets/app-locations.conf（片段存在但未生效）');
  }

  const missing = [...routeSegs].filter((s) => !nginxSegs.has(s)).sort();
  const stale = [...nginxSegs].filter((s) => !routeSegs.has(s)).sort();

  if (missing.length > 0) {
    errors.push(`nginx 白名单缺少路由段，线上将 404：${missing.join(', ')}`);
  }
  if (stale.length > 0) {
    errors.push(`nginx 白名单存在前端已不存在的路由段（应删）：${stale.join(', ')}`);
  }

  // 隐私页必须被 robots.txt 拒绝
  const robotsPath = path.join(ROOT, 'public/robots.txt');
  if (fs.existsSync(robotsPath)) {
    const robots = fs.readFileSync(robotsPath, 'utf8');
    for (const p of ['/profile', '/history', '/growth', '/collection']) {
      if (!robots.includes(`Disallow: ${p}`)) {
        errors.push(`robots.txt 缺少 Disallow: ${p}`);
      }
    }
  } else {
    errors.push('public/robots.txt 不存在');
  }

  // sitemap 里的 URL 必须都在白名单内（否则爬虫拿到 404）
  const sitemapPath = path.join(ROOT, 'public/sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const locs = [...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>[^<]*?\/([^/<]*)(?:<|\/)/g)]
      .map((m) => m[1])
      .filter(Boolean);
    for (const seg of new Set(locs)) {
      if (!nginxSegs.has(seg)) errors.push(`sitemap 收录了 nginx 未放行的路径：/${seg}`);
    }
  } else {
    errors.push('public/sitemap.xml 不存在');
  }

  console.log(`路由段（${routeSegs.size}）: ${[...routeSegs].sort().join(', ')}`);
  console.log(`nginx 白名单（${nginxSegs.size}）: ${[...nginxSegs].sort().join(', ')}`);
  console.log(`ERRORS: ${JSON.stringify(errors)}`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
