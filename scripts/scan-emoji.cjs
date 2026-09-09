/** scan-emoji.cjs — 扫描 src 下 vue/ts 文件的 emoji 使用（排除注释行） */
const fs = require('fs')
const path = require('path')

const dir = path.resolve('src')
const hits = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('node_modules')) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(vue|ts)$/.test(e.name)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
        if (/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(line)) {
          hits.push(`${p.replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 90)}`)
        }
      })
    }
  }
}
walk(dir)
console.log(hits.length ? hits.join('\n') : 'NO EMOJI FOUND')
