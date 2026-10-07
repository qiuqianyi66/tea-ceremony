#!/usr/bin/env node
/**
 * docs 元信息头批量补齐（285 Harness「文档头部加元信息」落地，doc-gardening 配套）。
 *
 * 规则：docs/**​/*.md 顶部插入 frontmatter：
 *   last_updated: <git 最后提交日期，无提交历史用文件 mtime>
 *   status: active
 *   owner: yanha
 *
 * 用法：
 *   node scripts/add-doc-meta.cjs --dry-run   # 只统计不写
 *   node scripts/add-doc-meta.cjs             # 补齐（幂等：已带 last_updated 跳过）
 *
 * 边界：已有 frontmatter 但缺 last_updated 的文件跳过并报告（保守，避免双 frontmatter）。
 * 行尾与 BOM 保持原样。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else if (e.name.endsWith('.md')) files.push(path.join(dir, e.name));
  }
})(path.join(ROOT, 'docs'));

const stats = { total: files.length, hasMeta: 0, hasFmNoMeta: 0, noFm: 0, skippedHasFmNoMeta: [] };

function lastCommitDate(rel) {
  try {
    const out = execSync(`git log -1 --format=%cs -- "${rel}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out || null;
  } catch { return null; }
}

let written = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const raw = fs.readFileSync(f);
  const bom = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF;
  const body = raw.slice(bom ? 3 : 0).toString('utf8');
  const crlf = body.includes('\r\n');

  const fmMatch = body.match(/^---[\s\S]*?---\r?\n/);
  if (fmMatch && fmMatch[0].includes('last_updated')) { stats.hasMeta++; continue; }
  if (fmMatch) { stats.hasFmNoMeta++; stats.skippedHasFmNoMeta.push(rel); continue; }

  stats.noFm++;
  if (DRY) continue;

  const date = lastCommitDate(rel) || new Date(fs.statSync(f).mtime).toISOString().slice(0, 10);
  // 行尾真正保持原样：block 用文件主导行尾，body 一字不改
  const nl = crlf ? '\r\n' : '\n';
  const block = `---${nl}last_updated: ${date}${nl}status: active${nl}owner: yanha${nl}---${nl}${nl}`;
  const out = block + body;
  fs.writeFileSync(f, (bom ? Buffer.from([0xEF, 0xBB, 0xBF]) : Buffer.alloc(0)));
  fs.writeFileSync(f, out, { encoding: 'utf8', flag: bom ? 'a' : 'w' });
  written++;
}

console.log(`docs md 总数 ${stats.total} | 已带元信息 ${stats.hasMeta} | 有 frontmatter 缺 last_updated ${stats.hasFmNoMeta} | 无 frontmatter ${stats.noFm}`);
if (stats.skippedHasFmNoMeta.length) {
  console.log('⚠ 跳过（已有 frontmatter 缺 last_updated，需人工处理）:');
  for (const s of stats.skippedHasFmNoMeta) console.log(`  ${s}`);
}
if (!DRY) console.log(`已写入 ${written} 个文件`);
