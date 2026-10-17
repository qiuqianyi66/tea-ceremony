#!/usr/bin/env node
/**
 * 常驻层压缩「零丢失」校验（迁移台账机器核对）。
 *
 * 背景：常驻层（AGENTS.md / CLAUDE.md / CONTEXT.md / .harness/rules/*.md）压缩时，
 * 最危险的失败不是"压得不够"，而是"悄悄丢了一条规则"——不报错、几周后才显形。
 * 本脚本把台账（.harness/changes/<slice>/ledger.json）变成可复核的断言：
 *
 *   baseline[]  改造前副本的 sha256 必须与台账记录一致（证明基线可追溯、未被改写）
 *   entries[]   每条被搬运/保留的内容，其 anchor 必须在 dest 文件里**逐字命中**
 *   dropped[]   允许删除，但必须写明 why（无理由的删除即 error）
 *
 * 用法：node scripts/audit-context-migration.cjs <ledger.json>
 *       node scripts/audit-context-migration.cjs           默认取 .harness/changes/r5-context-budget/ledger.json
 * 期望输出 ERRORS: []；有缺口 exit 1。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ledgerPath = path.resolve(
  ROOT,
  process.argv[2] || '.harness/changes/r5-context-budget/ledger.json',
);
const errors = [];
const warnings = [];

if (!fs.existsSync(ledgerPath)) {
  console.log(`ERRORS: [台账不存在：${ledgerPath}]`);
  process.exit(1);
}
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const readOrNull = (p) => {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
};

console.log(`=== 常驻层迁移台账核对：${ledger.round || ledgerPath}（${ledger.date || '未标日期'}）===`);

// 1. 基线副本完整性
// 保留期（ledger.baselineRetentionUntil，默认 14 天）内缺失 = 基线丢失，报 error；
// 过期后副本被正常清理 = 只报 warning（此时锚点校验仍是有效的零丢失证据）。
const retentionUntil = ledger.baselineRetentionUntil ? new Date(ledger.baselineRetentionUntil) : null;
const baselineExpired = retentionUntil ? Date.now() > retentionUntil.getTime() : false;
for (const b of ledger.baseline || []) {
  const abs = path.isAbsolute(b.backup) ? b.backup : path.join(ROOT, b.backup);
  if (!fs.existsSync(abs)) {
    const msg = `基线副本缺失：${b.backup}（${b.file} 的改造前原文）`;
    if (baselineExpired) warnings.push(`${msg}——副本保留期已过（${ledger.baselineRetentionUntil} 起可清理），只核对锚点`);
    else errors.push(msg);
    continue;
  }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  const chars = fs.readFileSync(abs, 'utf8').length;
  if (b.sha256 && sha !== b.sha256) errors.push(`基线副本被改动：${b.backup}（sha256 与台账不符）`);
  if (b.chars && chars !== b.chars) errors.push(`基线副本长度变化：${b.backup}（${chars} ≠ ${b.chars}）`);
  console.log(`${b.file}\t基线 ${chars} 字符\tsha256 ${sha.slice(0, 12)}…\t${b.backup}`);
}

// 2. 落点锚点逐字命中
const stat = { kept: 0, moved: 0, dropped: 0, anchors: 0, missing: 0 };
for (const e of ledger.entries || []) {
  stat[e.class] = (stat[e.class] || 0) + 1;
  if (e.class === 'dropped') {
    if (!e.why || !e.why.trim()) {
      errors.push(`dropped 条目缺 why（${e.from}：${e.desc}）——删除必须给理由`);
      stat.missing += 1;
    }
    continue;
  }
  const dest = readOrNull(e.dest);
  if (dest === null) {
    errors.push(`落点文件不存在：${e.dest}（来自 ${e.from}：${e.desc}）`);
    stat.missing += 1;
    continue;
  }
  const anchors = e.anchors || [];
  if (anchors.length === 0) errors.push(`条目无 anchor，无法核对：${e.desc}`);
  for (const a of anchors) {
    stat.anchors += 1;
    if (!dest.includes(a)) {
      stat.missing += 1;
      errors.push(`锚点未命中：${e.dest} 缺「${a}」（${e.class}，来自 ${e.from}：${e.desc}）`);
    }
  }
}

console.log(
  `条目：kept ${stat.kept || 0} / moved ${stat.moved || 0} / dropped ${stat.dropped || 0}；` +
    `锚点 ${stat.anchors} 个，未命中 ${stat.missing} 个`,
);
for (const w of warnings) console.log(`WARN ${w}`);
console.log(`ERRORS: [${errors.join(' | ')}]`);
process.exit(errors.length ? 1 : 0);
