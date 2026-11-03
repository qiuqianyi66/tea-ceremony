/** fs-utils.cjs — 脚本共享文件遍历：统一递归读目录，避免每个审计脚本各写一遍 walk()。 */
const fs = require('node:fs')
const path = require('node:path')

/**
 * 递归收集目录下的文件绝对路径。深度优先、保持 readdirSync 原序（不排序，结果与手写 walk 一致）。
 * @param {string} dir 起始目录
 * @param {object} [opts]
 * @param {Iterable<string>} [opts.exts] 扩展名集合（带前导点，大小写不敏感）；省略=不过滤
 * @param {Iterable<string>} [opts.skipDirs] 跳过的目录名集合；省略=不跳过
 * @returns {string[]}
 */
function collect(dir, opts = {}) {
  const { exts = null, skipDirs = null } = opts
  const extSet = exts ? new Set([...exts].map((e) => e.toLowerCase())) : null
  const skipSet = skipDirs ? new Set(skipDirs) : null
  const acc = []
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return // 目录不存在或不可读：静默跳过
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skipSet || !skipSet.has(e.name)) walk(path.join(d, e.name))
      } else if (!extSet || extSet.has(path.extname(e.name).toLowerCase())) {
        acc.push(path.join(d, e.name))
      }
    }
  }
  walk(dir)
  return acc
}

/** 读文本，失败返回 null（脚本里大量 try/catch 读文件）。 */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

module.exports = { collect, readText }
