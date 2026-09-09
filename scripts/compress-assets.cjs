// scripts/compress-assets.cjs
// 批量压缩「一盏茶」素材：茶/茶器最长边 800px 且 ≤80KB；产区图最长边 1600px 且 ≤150KB
// 用法：node scripts/compress-assets.cjs
// 注意：不会触碰 src/assets 下的 4 张既有大图（tea-mountain-hero / tearoom-bg / zisha-albedo / blue-white-porcelain）
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  { dir: path.join(ROOT, 'src', 'assets', 'teas'), maxEdge: 800, limitKB: 80 },
  { dir: path.join(ROOT, 'src', 'assets', 'wares'), maxEdge: 800, limitKB: 80 },
  { dir: path.join(ROOT, 'public', 'garden'), maxEdge: 1600, limitKB: 150 },
];
const QUALITY_START = 78;
const QUALITY_MIN = 45;

async function compressFile(file, cfg) {
  const buf = await sharp(file).rotate().metadata();
  const longest = Math.max(buf.width, buf.height);
  // 先降质量，仍超限再递减边长（复杂图像在目标边长下压不进体积上限时使用）
  for (let edge = cfg.maxEdge; edge >= Math.round(cfg.maxEdge * 0.6); edge -= 100) {
    let quality = QUALITY_START;
    let out;
    while (quality >= QUALITY_MIN) {
      out = await sharp(file)
        .rotate()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (out.length <= cfg.limitKB * 1024) break;
      quality -= 5;
    }
    const sizeKB = Math.round(out.length / 1024);
    if (sizeKB <= cfg.limitKB) {
      fs.writeFileSync(file + '.tmp', out);
      fs.renameSync(file + '.tmp', file);
      console.log(`  ok ${path.basename(file)}: ${longest}px -> edge=${edge}, q=${quality}, ${sizeKB}KB`);
      return true;
    }
  }
  console.log(`  OVER-LIMIT ${file}`);
  return false;
}

(async () => {
  let total = 0;
  let failed = 0;
  for (const cfg of TARGETS) {
    if (!fs.existsSync(cfg.dir)) {
      console.log(`SKIP missing dir: ${cfg.dir}`);
      continue;
    }
    const files = fs.readdirSync(cfg.dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`== ${cfg.dir} (${files.length} files)`);
    for (const f of files) {
      const full = path.join(cfg.dir, f);
      const ok = await compressFile(full, cfg);
      total++;
      if (!ok) failed++;
    }
  }
  console.log(`\nDONE: ${total} files, ${failed} over-limit`);
  process.exit(failed > 0 ? 1 : 0);
})();
