#!/usr/bin/env node
/**
 * audit-gitleaks-fingerprints.cjs — secret-scan 放行单的漂移审计（纯 fs，无依赖，可进 CI）
 *
 * 治的病（2026-11-04 实测踩到）：`.gitleaksignore` 的指纹格式是
 * `<路径>:<rule-id>:<行号>` —— **行号会随任何一次上方的插入/删除漂移**。
 * 当天在 `.github/workflows/ci.yml` 上方加了 5 行 CI step，ci.yml 里的
 * `JWT_SECRET`（合成测试值）就从 L231 漂到 L236，指纹失效 → secret-scan 直接变红，
 * 而被指的文件本身一个字都没错。这类红灯看起来像「PR 引入了密钥」，实际是放行单过期，
 * 排查成本全花在错误方向上。
 *
 * 判据（每条指纹三段校验）：
 *   ① 文件存在，且行号 ≤ 文件行数 —— 否则 ERROR（文件变短，指纹必然失效）
 *   ② 该行文本匹配「疑似密钥」正则（secret/token/key/password/jwt/passwd）—— 不匹配记 WARN
 *      （这是漂移的典型形态：行号指向了注释或空行）
 *   ③ 该行同时带 `gitleaks:allow` 行内注释 —— 记 INFO：双保险，指纹可删
 *
 * 明确不覆盖：gitleaks 的真实判定（本地无 gitleaks 二进制，无法离线复算规则）与
 * 「该放行的是不是真是合成值」——后者只能人工看一眼，本脚本只保证指针不漂。
 *
 * 输出契约：`ERRORS: [...]` + 退出码 1；全绿 `ERRORS: []`（与 audit-redlines.cjs 同族）。
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const IGNORE_FILE = path.join(root, '.gitleaksignore')
const SUSPICIOUS_RE = /secret|token|passwd|password|api[_-]?key|jwt|credential/i
const INLINE_ALLOW = 'gitleaks:allow'

/**
 * 解析 .gitleaksignore：跳过注释/空行，指纹自右向左拆（路径里可能含冒号，rule-id 里不会）。
 * @returns {{path: string, rule: string, line: number, raw: string}[]}
 */
function parseFingerprints(text) {
  const out = []
  for (const raw of String(text).split(/\r?\n/)) {
    const s = raw.trim()
    if (s === '' || s.startsWith('#')) continue
    const m = s.match(/^(.*):([A-Za-z0-9-]+):(\d+)$/)
    if (!m) continue
    out.push({ path: m[1], rule: m[2], line: Number(m[3]), raw: s })
  }
  return out
}

/** 逐条校验；返回 {errors, warns, infos}。抽成纯函数便于单测。 */
function audit(fingerprints, readFile) {
  const errors = []
  const warns = []
  const infos = []
  for (const fp of fingerprints) {
    const full = path.join(root, fp.path)
    let content
    try {
      content = readFile(full)
    } catch {
      errors.push(`指纹指向的文件不存在：${fp.path}（${fp.raw}）`)
      continue
    }
    const lines = content.split(/\r?\n/)
    if (fp.line > lines.length) {
      errors.push(`指纹行号越界：${fp.path}:${fp.line}（文件只有 ${lines.length} 行）`)
      continue
    }
    const text = lines[fp.line - 1] ?? ''
    if (!SUSPICIOUS_RE.test(text)) {
      warns.push(
        `指纹疑似漂移：${fp.path}:${fp.line} 指向的行不像密钥（指针失效时 secret-scan 会突然变红）`,
      )
      continue
    }
    if (text.includes(INLINE_ALLOW)) {
      infos.push(`双保险：${fp.path}:${fp.line} 已带行内 ${INLINE_ALLOW}，此条指纹可删`)
    }
  }
  return { errors, warns, infos }
}

function main() {
  if (!fs.existsSync(IGNORE_FILE)) {
    console.log('ERRORS: []')
    console.log('（无 .gitleaksignore，跳过）')
    return
  }
  const fingerprints = parseFingerprints(fs.readFileSync(IGNORE_FILE, 'utf8'))
  const { errors, warns, infos } = audit(fingerprints, (p) => fs.readFileSync(p, 'utf8'))

  console.log(`指纹 ${fingerprints.length} 条`)
  for (const i of infos) console.log(`INFO ${i}`)
  for (const w of warns) console.log(`WARN ${w}`)
  console.log(`ERRORS: ${JSON.stringify(errors)}`)
  if (errors.length > 0) process.exitCode = 1
}

if (require.main === module) main()

module.exports = { parseFingerprints, audit }
