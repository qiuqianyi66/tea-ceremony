/** scan-emoji.cjs — 扫描 src 下 vue/ts 文件的 emoji 使用（排除注释行） */
const fs = require('fs')
const path = require('path')
const { collect } = require('./lib/fs-utils.cjs')

const dir = path.resolve('src')
const hits = []
for (const p of collect(dir, { exts: ['.vue', '.ts'], skipDirs: ['node_modules'] })) {
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
    if (/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(line)) {
      hits.push(`${p.replace(/\\/g, '/')}:${i + 1}: ${line.trim().slice(0, 90)}`)
    }
  })
}
console.log(hits.length ? hits.join('\n') : 'NO EMOJI FOUND')
