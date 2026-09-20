/**
 * 3D 地面纹理转 KTX2（P2-8，expand-contract 的一部分）
 * 用法：node scripts/convert-3d-ktx2.cjs
 *
 * 依赖：toktx（KTX-Software）已安装到默认路径；可通过环境变量 TOKTX_PATH 覆盖。
 * 产物：public/3d/textures/terrain/*.ktx2（保留原 .jpg 供回退，扩容不删旧）
 *
 * 编码选择：
 *  - diff（颜色贴图）：ETC1S + sRGB + q160，体积优先，地面远景可接受；
 *  - nor_gl（法线贴图）：ETC1S + linear（法线是线性数据），q160；
 *  - 两者都 --genmipmap（three 纹理默认需要 mip，KTX2 内嵌免运行时生成）。
 */
const { execFileSync } = require('node:child_process')
const { existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const TERRAIN_DIR = join(__dirname, '..', 'public', '3d', 'textures', 'terrain')
const TOKTX = process.env.TOKTX_PATH || 'C:\\Program Files\\KTX-Software\\bin\\toktx.exe'

if (!existsSync(TOKTX)) {
  console.error(`[convert-3d-ktx2] 找不到 toktx：${TOKTX}（请安装 KTX-Software 或设置 TOKTX_PATH）`)
  process.exit(1)
}

const jpgs = readdirSync(TERRAIN_DIR).filter((f) => f.endsWith('.jpg'))
if (jpgs.length === 0) {
  console.error(`[convert-3d-ktx2] ${TERRAIN_DIR} 下没有 .jpg`)
  process.exit(1)
}

for (const jpg of jpgs) {
  const ktx2 = jpg.replace(/\.jpg$/, '.ktx2')
  const outPath = join(TERRAIN_DIR, ktx2)
  const inPath = join(TERRAIN_DIR, jpg)
  const isNormal = jpg.includes('nor_gl')
  const args = [
    '--encode', 'etc1s',
    '--genmipmap',
    '--assign_oetf', isNormal ? 'linear' : 'srgb',
    '--assign_primaries', 'bt709',
    '-q', '160',
    outPath, inPath,
  ]
  try {
    execFileSync(TOKTX, args, { stdio: 'pipe' })
    const sizeKb = Math.round(require('node:fs').statSync(outPath).size / 1024)
    console.log(`[ok] ${jpg} -> ${ktx2} (${sizeKb} KB)`)
  } catch (err) {
    console.error(`[fail] ${jpg}: ${err.stderr?.toString().slice(0, 200) || err.message}`)
    process.exitCode = 1
  }
}
