#!/usr/bin/env node
/**
 * 线上部署验收：判断「新版本到底有没有真的上线」。
 *
 * 为什么需要它：2026-10-19 实测发现线上 443 已开、证书受信，但 `/` 的
 * Last-Modified 还是 5 天前，且没有 HSTS / CSP、`/.env` 仍返回 index.html、
 * 80 不跳转、ALPN 只协商 http/1.1 —— 也就是「看起来部署了，实际前端与 nginx
 * 配置都是旧的」。这种半成品状态没有任何报错，只能靠逐项探测暴露。
 *
 * 用法：
 *   node scripts/verify-production.cjs --base https://42.121.125.4
 *   node scripts/verify-production.cjs --base https://42.121.125.4 --since 2026-10-19
 *   node scripts/verify-production.cjs --base https://42.121.125.4 --insecure   # 自签证书时
 *
 * 退出码：有 FAIL 即 1。WARN 不影响退出码（例如 CDN 不转发 ALPN）。
 *
 * 设计取舍：不引入 supertest/axios 等依赖，Node 内置 https/http2 足够，
 * 且 http2 模块是唯一能可靠读到 ALPN 协商结果的内置手段（curl 在 Windows 上不支持 --http2）。
 */

const http = require('node:http')
const https = require('node:https')
const http2 = require('node:http2')

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}

const BASE = String(arg('base', 'https://42.121.125.4')).replace(/\/$/, '')
const INSECURE = arg('insecure', false) === true
const SINCE = arg('since', null)
const TIMEOUT = 15000

const results = []
function record(id, status, detail) {
  results.push({ id, status, detail })
}
const pass = (id, detail) => record(id, 'PASS', detail)
const fail = (id, detail) => record(id, 'FAIL', detail)
const warn = (id, detail) => record(id, 'WARN', detail)

/** 发一次请求，返回 { status, headers, body, tlsError } */
function request(url, { method = 'GET', followRedirect = false, maxBody = 64 * 1024 } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        timeout: TIMEOUT,
        rejectUnauthorized: !INSECURE,
        headers: { 'User-Agent': 'tea-deploy-verify/1.0' },
      },
      (res) => {
        if (followRedirect && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          resolve({ status: res.statusCode, headers: res.headers, body: '', redirectedTo: res.headers.location })
          return
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => {
          if (body.length < maxBody) body += c
        })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (e) => resolve({ error: e.code || e.message }))
    req.end()
  })
}

async function checkHttps() {
  const r = await request(`${BASE}/`)
  if (r.error === 'DEPTH_ZERO_SELF_SIGNED_CERT' || r.error === 'SELF_SIGNED_CERT_IN_CHAIN' || r.error === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    fail('cert-trusted', `证书不受信（${r.error}）。若是自签请加 --insecure，但生产必须换受信证书`)
    return null
  }
  if (r.error) {
    fail('https-reachable', `${BASE}/ 不可达: ${r.error}`)
    return null
  }
  if (r.status !== 200) {
    fail('https-reachable', `期望 200，实际 ${r.status}`)
    return r
  }
  pass('https-reachable', `200，${r.body.length} 字节`)
  pass('cert-trusted', 'TLS 校验通过（未使用 --insecure）')
  return r
}

function checkHeaders(res) {
  const h = res.headers
  const need = [
    ['strict-transport-security', /max-age=\d{6,}/],
    ['content-security-policy', /default-src/],
    ['x-content-type-options', /nosniff/],
    ['x-frame-options', /DENY|SAMEORIGIN/],
    ['referrer-policy', /.+/],
    ['permissions-policy', /.+/],
  ]
  const missing = need.filter(([name, re]) => !re.test(h[name] || '')).map(([n]) => n)
  if (missing.length === 0) pass('security-headers', 'HSTS + CSP + XCTO + XFO + Referrer + Permissions 全在')
  else fail('security-headers', `缺失或不合格: ${missing.join(', ')}`)

  const hsts = h['strict-transport-security'] || ''
  if (/includeSubDomains/i.test(hsts)) warn('hsts-scope', 'HSTS 含 includeSubDomains；裸 IP 部署无子域，通常不需要')
}

async function checkHttp2() {
  await new Promise((resolve) => {
    let settled = false
    const done = (fn) => {
      if (settled) return
      settled = true
      fn()
      resolve()
    }
    let client
    try {
      client = http2.connect(BASE, INSECURE ? { rejectUnauthorized: false } : {})
    } catch (e) {
      done(() => fail('http2', `无法建立 h2 连接: ${e.message}`))
      return
    }
    client.on('error', (e) => done(() => fail('http2', `h2 连接错误: ${e.code || e.message}`)))
    client.on('connect', () => {
      const proto = client.alpnProtocol
      done(() => {
        if (proto === 'h2') pass('http2', 'ALPN 协商为 h2')
        else fail('http2', `ALPN 协商为 ${proto || '(空)'}，nginx 未启用 http2`)
      })
      client.close()
    })
    setTimeout(() => done(() => fail('http2', 'h2 握手超时')), TIMEOUT)
  })
}

async function checkHttpRedirect() {
  const u = new URL(BASE)
  const httpBase = `http://${u.hostname}${u.port ? `:${u.port}` : ''}`
  const r = await request(`${httpBase}/garden`)
  if (r.error) {
    fail('http-redirect', `http 探测失败: ${r.error}`)
    return
  }
  const isRedirect = r.status >= 300 && r.status < 400
  const loc = r.headers.location || ''
  if (isRedirect && loc.startsWith('https://')) pass('http-redirect', `${r.status} → ${loc}`)
  else fail('http-redirect', `期望 301 到 https，实际 ${r.status}${loc ? ` → ${loc}` : ''}`)

  // ACME 挑战必须可达（不能 301），否则证书无法续期
  const acme = await request(`${httpBase}/.well-known/acme-challenge/deploy-verify-probe`)
  if (acme.error) fail('acme-not-redirected', `探测失败: ${acme.error}`)
  else if (acme.status >= 300 && acme.status < 400) fail('acme-not-redirected', `被 ${acme.status} 跳转，续期会失败`)
  else pass('acme-not-redirected', `返回 ${acme.status}（未跳转即可）`)
}

async function checkContentContracts() {
  const robots = await request(`${BASE}/robots.txt`)
  if (robots.error) fail('robots-text', robots.error)
  else if (/<html/i.test(robots.body || '')) fail('robots-text', 'robots.txt 返回 HTML —— 被 SPA fallback 兜住了')
  else if (/disallow/i.test(robots.body || '')) pass('robots-text', '纯文本 robots.txt')
  else warn('robots-text', '内容里没有 Disallow，确认是否预期')

  const sitemap = await request(`${BASE}/sitemap.xml`)
  if (sitemap.error) fail('sitemap-xml', sitemap.error)
  else if (/<urlset/i.test(sitemap.body || '')) pass('sitemap-xml', '合法 urlset')
  else fail('sitemap-xml', '不是 sitemap XML（很可能是 SPA fallback 的 HTML）')

  const dotenv = await request(`${BASE}/.env`)
  if (dotenv.error) warn('dotenv-404', `探测失败: ${dotenv.error}`)
  else if (dotenv.status === 404) pass('dotenv-404', '404（soft-404 已修）')
  else fail('dotenv-404', `返回 ${dotenv.status} —— 任意路径回 200 的 soft-404 仍然存在`)

  const manifest = await request(`${BASE}/manifest.webmanifest`)
  const mct = (manifest.headers && manifest.headers['content-type']) || ''
  if (manifest.status === 200 && /manifest\+json|application\/json/.test(mct)) pass('manifest-mime', mct)
  else fail('manifest-mime', `status=${manifest.status} content-type=${mct || '(空)'}`)

  const sw = await request(`${BASE}/sw.js`)
  const sct = (sw.headers && sw.headers['content-type']) || ''
  if (sw.status === 200 && /javascript/.test(sct)) pass('sw-js-mime', sct)
  else fail('sw-js-mime', `status=${sw.status} content-type=${sct || '(空)'}`)
}

async function checkBackend() {
  const health = await request(`${BASE}/actuator/health`)
  if (health.status === 200 && /"status"\s*:\s*"UP"/.test(health.body || '')) pass('actuator-health', 'UP')
  else fail('actuator-health', `status=${health.status} body=${(health.body || '').slice(0, 60)}`)

  // 指标端点不应公网可达：backend 只绑 127.0.0.1，nginx 只放行 = /actuator/health
  const prom = await request(`${BASE}/actuator/prometheus`)
  if (prom.status === 404) pass('prometheus-not-public', '404')
  else if (prom.status === 200 && /^# HELP/m.test(prom.body || '')) {
    fail('prometheus-not-public', '200 且返回了真实指标 —— 内部指标对公网暴露')
  } else if (prom.status === 200 && /<html/i.test(prom.body || '')) {
    fail('prometheus-not-public', '200 但返回 HTML —— 被 SPA fallback 兜住（说明 soft-404 未修，同时 /actuator/health 也不会通）')
  } else fail('prometheus-not-public', `status=${prom.status}（期望 404）`)
}

async function checkFreshness(res) {
  if (!SINCE) {
    warn('build-freshness', '未提供 --since，跳过构建新鲜度检查（建议部署时传部署日期）')
    return
  }
  const lm = res.headers['last-modified']
  if (!lm) {
    warn('build-freshness', '响应没有 Last-Modified，无法判断构建时间')
    return
  }
  const built = new Date(lm)
  const since = new Date(SINCE)
  if (Number.isNaN(built.getTime())) {
    warn('build-freshness', `Last-Modified 无法解析: ${lm}`)
    return
  }
  if (built >= since) pass('build-freshness', `构建于 ${built.toISOString()}，不早于 ${since.toISOString()}`)
  else fail('build-freshness', `构建于 ${built.toISOString()}，早于 ${since.toISOString()} —— 前端镜像没重建`)
}

async function main() {
  console.log(`部署验收目标: ${BASE}${SINCE ? `（要求构建不早于 ${SINCE}）` : ''}\n`)
  const res = await checkHttps()
  if (res) {
    checkHeaders(res)
    await checkFreshness(res)
  } else {
    warn('security-headers', '首页不可达，跳过')
    warn('build-freshness', '首页不可达，跳过')
  }
  await checkHttp2()
  await checkHttpRedirect()
  await checkContentContracts()
  await checkBackend()

  const width = Math.max(...results.map((r) => r.id.length))
  for (const r of results) {
    const tag = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗'
    console.log(`${tag} ${r.id.padEnd(width)}  ${r.detail}`)
  }
  const failed = results.filter((r) => r.status === 'FAIL').length
  const warned = results.filter((r) => r.status === 'WARN').length
  console.log(`\n合计 ${results.length} 项：${results.length - failed - warned} PASS / ${warned} WARN / ${failed} FAIL`)
  if (failed > 0) {
    console.log('\n结论：线上不是当前版本，或配置未生效。先确认 frontend 镜像已重建并重启。')
    process.exit(1)
  }
  console.log('\n结论：部署验收通过。')
}

main()
