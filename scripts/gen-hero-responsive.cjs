#!/usr/bin/env node
/**
 * 生成 hero 图的响应式变体（WebP + JPEG 双格式）。
 *
 * 为什么需要：线上实测 hero 图 1920×886 / 297 KB，移动端实际显示宽度仅 421 px，
 * 等于每个手机用户白下载约 250 KB，而它是首屏 LCP 元素。
 * 项目未接 vite-imagetools，sharp 已在 devDependencies 里，故用脚本预生成并入库。
 *
 * 产物：src/assets/hero/tea-mountain-hero-{640,1280,1920}.{webp,jpg}
 * 用法：node scripts/gen-hero-responsive.cjs
 * 幂等：源图 mtime 未变则跳过（--force 强制重生成）。
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/assets/tea-mountain-hero.jpg');
const OUT_DIR = path.join(ROOT, 'src/assets/hero');
const WIDTHS = [640, 1280, 1920];
const STAMP = path.join(OUT_DIR, '.stamp');

async function main() {
  const force = process.argv.includes('--force');
  if (!fs.existsSync(SRC)) {
    console.error(`源图不存在：${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const srcMtime = fs.statSync(SRC).mtimeMs;
  if (!force && fs.existsSync(STAMP) && Number(fs.readFileSync(STAMP, 'utf8')) === srcMtime) {
    console.log('源图未变更，跳过生成（--force 可强制）');
    return;
  }

  const meta = await sharp(SRC).metadata();
  console.log(`源图 ${meta.width}×${meta.height}`);

  for (const w of WIDTHS) {
    if (w > meta.width) {
      console.log(`跳过 ${w}：超过源图宽度`);
      continue;
    }
    const base = { width: w, withoutEnlargement: true };

    const webp = path.join(OUT_DIR, `tea-mountain-hero-${w}.webp`);
    await sharp(SRC).resize(base).webp({ quality: 78, effort: 5 }).toFile(webp);

    const jpg = path.join(OUT_DIR, `tea-mountain-hero-${w}.jpg`);
    await sharp(SRC).resize(base).jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(jpg);

    const wp = fs.statSync(webp).size;
    const jp = fs.statSync(jpg).size;
    console.log(`  ${w}px → webp ${(wp / 1024).toFixed(1)} KB / jpg ${(jp / 1024).toFixed(1)} KB`);
  }

  fs.writeFileSync(STAMP, String(srcMtime));
  console.log(`完成，输出目录：${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
