#!/usr/bin/env node
/**
 * nginx 安全头 + HTTPS 结构完整性检查（机械化 R-nginx-headers 规则）。
 *
 * 要防的历史缺陷：nginx 的 add_header 是「全有或全无」继承 —— 某个 location
 * 一旦自己写了任意 add_header，server 级声明的所有 add_header 对它全部失效。
 * 线上实测过这个坑：location / 写了 add_header Cache-Control，导致首页的
 * CSP / X-Frame-Options / nosniff / Referrer-Policy 全部消失，响应头只剩缓存相关项。
 * 同一个机制让「HSTS 写在 443 server 块」变成半个摆设，所以 HSTS 必须放在
 * security-headers.conf 里（每个带 add_header 的 location 都会 include 它）。
 *
 * 本脚本做的事：
 *   1. 任何带 add_header 的 location，必须 include security-headers 片段
 *   2. /api/ 代理块必须 proxy_hide_header 掉与后端重复的三个头
 *      （否则 nginx 与 Spring 各发一份，nginx 拼成 "DENY,DENY"，浏览器判定非法并丢弃）
 *   3. 每个 server 块必须开 server_tokens off
 *   4. 禁止出现重复指令形态（如 "no-cache,no-cache"）
 *   5. nginx/Dockerfile 必须把 snippets 复制进镜像（否则 include 直接失败）
 *   6. 关键路径存在性
 *   7. HSTS 形态：有 max-age=31536000，没有 includeSubDomains（裸 IP 无子域）
 *   8. 443 server 的 TLS 参数与 include 完整
 *   9. 80 server 的 ACME 区块存在且**没有被 301 跳掉**
 *
 * 2026-10-18：location 段搬到 nginx/snippets/app-locations.conf 后，
 * 本脚本把 nginx.conf 与片段合并分析（原 80 端口的 location 校验能力全部保留）。
 *
 * 用法：node scripts/verify-nginx-headers.cjs
 * 期望输出 ERRORS: []；有缺口 exit 1。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NGINX_CONF = path.join(ROOT, 'nginx.conf');
const APP_LOCATIONS = path.join(ROOT, 'nginx/snippets/app-locations.conf');
const SNIPPET = path.join(ROOT, 'nginx/snippets/security-headers.conf');
const DOCKERFILE = path.join(ROOT, 'nginx/Dockerfile');

const errors = [];

if (!fs.existsSync(SNIPPET)) {
  errors.push('nginx/snippets/security-headers.conf 不存在');
}
if (!fs.existsSync(APP_LOCATIONS)) {
  errors.push('nginx/snippets/app-locations.conf 不存在');
}

/** ---- 去掉整行注释，避免注释里的示例代码干扰判断 ---- */
const stripComments = (text) =>
  text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const rawMain = fs.readFileSync(NGINX_CONF, 'utf8');
const active = [
  stripComments(rawMain),
  fs.existsSync(APP_LOCATIONS) ? stripComments(fs.readFileSync(APP_LOCATIONS, 'utf8')) : '',
].join('\n');

/** 按花括号抓取块；header 允许为空（server { 没有名字） */
function extractBlocks(text, regex) {
  const blocks = [];
  const re = new RegExp(regex.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const header = (m[1] || '').trim();
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

const locations = extractBlocks(active, /location\s+([^{]+)\{/);
const servers = extractBlocks(active, /server\s*\{/);
const server80 = servers.find((s) => /listen\s+80\s*;/.test(s.body));
const server443 = servers.find((s) => /listen\s+443\s+ssl\s*;/.test(s.body));

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

// ---- 规则 3：每个 server 块都要 server_tokens off ----
if (servers.length === 0) {
  errors.push('nginx.conf 里没有 server 块');
}
for (const s of servers) {
  if (!/server_tokens\s+off\s*;/.test(s.body)) {
    const which = /listen\s+443/.test(s.body) ? '443' : /listen\s+80/.test(s.body) ? '80' : '未知端口';
    errors.push(`${which} server 缺少 server_tokens off;（会暴露 nginx 版本号）`);
  }
}

// ---- 规则 4：重复指令形态 ----
const dupPatterns = [/no-cache\s*,\s*no-cache/, /nosniff\s*,\s*nosniff/, /DENY\s*,\s*DENY/];
for (const p of dupPatterns) {
  if (p.test(active)) errors.push(`nginx 配置出现重复指令形态：${p}`);
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
  if (!active.includes(must)) errors.push(`nginx 配置缺少 ${must}`);
}

// ---- 规则 7：HSTS 形态（裸 IP：不加 includeSubDomains）----
if (fs.existsSync(SNIPPET)) {
  const headers = stripComments(fs.readFileSync(SNIPPET, 'utf8'));
  const hsts = headers.match(/add_header\s+Strict-Transport-Security\s+"([^"]*)"/i);
  if (!hsts) {
    errors.push('security-headers.conf 缺少 HSTS（add_header 无部分继承，写 server 级会被 location 丢掉）');
  } else {
    if (!/max-age=31536000/.test(hsts[1])) errors.push(`HSTS max-age 不是 31536000：${hsts[1]}`);
    if (/includeSubDomains/i.test(hsts[1])) {
      errors.push(`HSTS 不应带 includeSubDomains（裸 IP 无子域）：${hsts[1]}`);
    }
  }
}

// ---- 规则 8：443 server 结构 ----
if (!server443) {
  errors.push('没有 listen 443 ssl 的 server 块（HTTPS 未真正启用）');
} else {
  const b = server443.body;
  const need = [
    [/http2\s+on\s*;/, 'http2 on;'],
    [/ssl_certificate\s+\/etc\/nginx\/certs\/fullchain\.pem\s*;/, 'ssl_certificate /etc/nginx/certs/fullchain.pem;'],
    [/ssl_certificate_key\s+\/etc\/nginx\/certs\/privkey\.pem\s*;/, 'ssl_certificate_key /etc/nginx/certs/privkey.pem;'],
    [/ssl_protocols\s+TLSv1\.2\s+TLSv1\.3\s*;/, 'ssl_protocols TLSv1.2 TLSv1.3;'],
    [/ssl_session_cache\s+shared:/, 'ssl_session_cache shared:...'],
    [/ssl_session_tickets\s+off\s*;/, 'ssl_session_tickets off;'],
    [/ssl_stapling\s+off\s*;/, 'ssl_stapling off;（LE 已停 OCSP，开着只会刷日志）'],
    [/include\s+\S*snippets\/app-locations\.conf\s*;/, 'include snippets/app-locations.conf;'],
  ];
  for (const [re, label] of need) {
    if (!re.test(b)) errors.push(`443 server 缺少 ${label}`);
  }
  if (!/listen\s+443\s+ssl\s*;/.test(b)) errors.push('443 server 的 listen 必须是 "listen 443 ssl;"');
}

// ---- 规则 9：80 server 的 ACME 不能被 301 跳掉 ----
if (!server80) {
  errors.push('没有 listen 80 的 server 块（ACME HTTP-01 会断，证书无法续期）');
} else {
  const b = server80.body;
  const acme = b.match(/location\s+\^~\s+\/\.well-known\/acme-challenge\/\s*\{[^}]*\}/);
  if (!acme) {
    errors.push('80 server 缺少 "location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }"');
  } else if (/root\s+\/var\/www\/certbot/.test(acme[0]) === false) {
    errors.push('ACME location 的 root 必须是 /var/www/certbot（certbot-www 挂载点）');
  } else if (/return\s+30[17]/.test(acme[0])) {
    errors.push('ACME location 里出现 return 301/307 → 挑战会被跳走，证书续期必然失败');
  }
  if (!/return\s+301\s+https:\/\/\$host\$request_uri\s*;/.test(b)) {
    errors.push('80 server 缺少 "return 301 https://$host$request_uri;"（明文 HTTP 未强制跳转）');
  }
}

console.log(`检查 ${servers.length} 个 server 块、${locations.length} 个 location 块`);
console.log(`ERRORS: ${JSON.stringify(errors)}`);
process.exit(errors.length > 0 ? 1 : 0);
