#!/usr/bin/env node
/**
 * nginx 安全头完整性检查（机械化 R-nginx-headers 规则）。
 *
 * 要防的历史缺陷：nginx 的 add_header 是「全有或全无」继承 —— 某个 location
 * 一旦自己写了任意 add_header，server 级声明的所有 add_header 对它全部失效。
 * 线上实测过这个坑：location / 写了 add_header Cache-Control，导致首页的
 * CSP / X-Frame-Options / nosniff / Referrer-Policy 全部消失，响应头只剩缓存相关项。
 *
 * 本脚本做四件事：
 *   1. 任何带 add_header 的 location，必须 include security-headers 片段
 *   2. /api/ 代理块必须 proxy_hide_header 掉与后端重复的三个头
 *      （否则 nginx 与 Spring 各发一份，nginx 拼成 "DENY,DENY"，浏览器判定非法并丢弃）
 *   3. server 块必须开 server_tokens off
 *   4. 禁止出现重复指令形态（如 "no-cache,no-cache"）
 *
 * 用法：node scripts/verify-nginx-headers.cjs
 * 期望输出 ERRORS: []；有缺口 exit 1。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NGINX_CONF = path.join(ROOT, 'nginx.conf');
const SNIPPET = path.join(ROOT, 'nginx/snippets/security-headers.conf');
const DOCKERFILE = path.join(ROOT, 'nginx/Dockerfile');

const errors = [];

if (!fs.existsSync(SNIPPET)) {
  errors.push('nginx/snippets/security-headers.conf 不存在');
}

const src = fs.readFileSync(NGINX_CONF, 'utf8');

// ---- 去掉整行注释，避免注释里的示例代码干扰判断 ----
const active = src
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

/** 按花括号抓取每个 location 块（不支持嵌套 location，本项目也没有） */
function extractBlocks(text, keyword) {
  const blocks = [];
  const re = new RegExp(`${keyword}\\s+([^{]+)\\{`, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const header = m[1].trim();
    let depth = 1;
    let i = re.lastIndex;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    blocks.push({ header, body: text.slice(re.lastIndex, i - 1) });
  }
  return blocks;
}

const locations = extractBlocks(active, 'location');

// ---- 规则 1：带 add_header 的 location 必须 include 安全头片段 ----
for (const loc of locations) {
  const hasAddHeader = /^\s*add_header\s/m.test(loc.body);
  const includesSnippet = /include\s+\S*snippets\/security-headers\.conf/.test(loc.body);
  if (hasAddHeader && !includesSnippet) {
    errors.push(
      `location ${loc.header} 自带 add_header 但未 include security-headers.conf → 该路径下 CSP/X-Frame-Options/nosniff 会全部失效`,
    );
  }
}

// ---- 规则 2：/api/ 必须剥离上游重复头 ----
const apiBlock = locations.find((l) => l.header === '/api/');
if (!apiBlock) {
  errors.push('未找到 location /api/ 代理块');
} else {
  for (const h of ['X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection']) {
    if (!new RegExp(`proxy_hide_header\\s+${h}`, 'i').test(apiBlock.body)) {
      errors.push(`location /api/ 缺少 proxy_hide_header ${h} → 会与后端拼成非法值`);
    }
  }
  if (/\badd_header\b/.test(apiBlock.body)) {
    errors.push('location /api/ 不应设置 add_header，安全头由后端独占');
  }
}

// ---- 规则 3：server_tokens off ----
if (!/server_tokens\s+off\s*;/.test(active)) {
  errors.push('缺少 server_tokens off;（会暴露 nginx 版本号）');
}

// ---- 规则 4：重复指令形态 ----
const dupPatterns = [/no-cache\s*,\s*no-cache/, /nosniff\s*,\s*nosniff/, /DENY\s*,\s*DENY/];
for (const p of dupPatterns) {
  if (p.test(active)) errors.push(`nginx.conf 出现重复指令形态：${p}`);
}

// ---- 规则 5：Dockerfile 必须把 snippets 复制进镜像 ----
if (fs.existsSync(DOCKERFILE)) {
  const df = fs.readFileSync(DOCKERFILE, 'utf8');
  if (!/COPY\s+nginx\/snippets\/\s+\/etc\/nginx\/snippets\//.test(df)) {
    errors.push('nginx/Dockerfile 未 COPY nginx/snippets/ 到 /etc/nginx/snippets/（include 会失败）');
  }
} else {
  errors.push('nginx/Dockerfile 不存在');
}

// ---- 规则 6：关键路径存在性 ----
for (const must of [
  'location = /manifest.webmanifest',
  'location = /actuator/health',
  'location = /robots.txt',
  'location = /sitemap.xml',
]) {
  if (!active.includes(must)) errors.push(`nginx.conf 缺少 ${must}`);
}

console.log(`检查 ${locations.length} 个 location 块`);
console.log(`ERRORS: ${JSON.stringify(errors)}`);
process.exit(errors.length > 0 ? 1 : 0);
