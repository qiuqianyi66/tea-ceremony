#!/usr/bin/env node
/**
 * agent-eval.cjs — 切片协作质量自动检查（agent-eval 技能配套脚本）
 * 用法: node scripts/agent-eval.cjs <切片名>   # 切片名 = .harness/changes/ 下目录名
 * 检查: T1 三件套+评审分级+commit 规范 / T2 契约登记 / T4 迁移成对
 * 输出: console 评分表, 全 PASS 退出码 0
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const slice = process.argv[2];
if (!slice) {
  console.error('usage: node scripts/agent-eval.cjs <slice-name>');
  process.exit(1);
}

const results = [];
const add = (id, pass, detail) => results.push({ id, pass, detail });

// T1-1 三件套 + review.md 存在（db-migrations/rollback 缺失时看 summary 是否声明零迁移）
const ch = path.join(root, '.harness', 'changes', slice);
const needed = ['summary.md', 'db-migrations.sql', 'rollback.sql', 'review.md'];
const summaryPath = path.join(ch, 'summary.md');
const summaryText = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '';
const noMigrate = /无(数据库)?迁移|零迁移|无迁移/.test(summaryText);
for (const f of needed) {
  const ok = fs.existsSync(path.join(ch, f));
  if (f.startsWith('db-migrations') || f === 'rollback.sql') {
    add(`T1-${f}`, ok || noMigrate, `${f} ${ok ? '存在' : noMigrate ? '缺失（summary 声明零迁移，允许省略）' : '缺失'}`);
  } else {
    add(`T1-${f}`, ok, `${f} ${ok ? '存在' : '缺失'}`);
  }
}

// T1-2 review 结论行 🔴🟡 清零（解析汇总数字，非全文符号计数）
const review = path.join(ch, 'review.md');
if (fs.existsSync(review)) {
  const text = fs.readFileSync(review, 'utf8');
  const m = text.match(/🔴\s*(?:(?<rnum>\d+)|(?:零|无))[^🟡]*?🟡\s*(?:(?<ynum>\d+)|(?:零|无))/);
  const red = m ? Number(m.groups.rnum ?? 0) : null;
  const yellow = m ? Number(m.groups.ynum ?? 0) : null;
  add(
    'T1-review',
    red !== null && red === 0 && yellow === 0,
    red === null ? '未找到结论行（🔴 N / 🟡 N）' : `结论行 🔴=${red} 🟡=${yellow}${red + yellow > 0 ? ' 未清零' : ''}`
  );
}

// T1-3 HEAD commit 为 conventional 格式且 subject ≤72
try {
  const log = execSync('git log -1 --pretty=%s', { cwd: root, encoding: 'utf8' }).trim();
  const m = log.match(/^(feat|fix|refactor|perf|test|docs|chore|style)(\([^)]+\))?: .+/);
  add('T1-commit', !!m && log.length <= 72, `HEAD "${log}" ${m && log.length <= 72 ? '符合' : '不符合 conventional/超长'}`);
} catch (e) {
  add('T1-commit', false, `git log 失败: ${e.message}`);
}

// T2-1 summary 中 /api/ 路径均已登记到 api-contract.md
const summary = path.join(ch, 'summary.md');
const contract = path.join(root, '.harness', 'wiki', 'api-contract.md');
if (fs.existsSync(summary) && fs.existsSync(contract)) {
  const s = fs.readFileSync(summary, 'utf8');
  const paths = [...new Set((s.match(/\/api\/[^\s|*?、`()（）"'，。；]+/g) || []))];
  const c = fs.readFileSync(contract, 'utf8');
  const missing = paths.filter((p) => !c.includes(p));
  add('T2-contract', missing.length === 0, paths.length ? (missing.length ? `未登记: ${missing.join(', ')}` : `契约登记 ${paths.length} 个路径`) : 'summary 无 /api/ 路径（检查跳过）');
}

// T4-1 迁移成对（有迁移时）
const mig = path.join(ch, 'db-migrations.sql');
const rb = path.join(ch, 'rollback.sql');
if (fs.existsSync(mig) || fs.existsSync(rb)) {
  const pair =
    fs.existsSync(mig) && fs.existsSync(rb) && fs.statSync(mig).size > 0 && fs.statSync(rb).size > 0;
  add('T4-migrate', pair, pair ? '迁移成对且非空' : '迁移缺失/未成对/为空');
} else {
  add('T4-migrate', true, '无迁移（零迁移切片）');
}

console.log(`\nagent-eval: ${slice}\n`);
let fail = 0;
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.id}: ${r.detail}`);
  if (!r.pass) fail++;
}
console.log(`\n${fail === 0 ? 'PASS' : `FAIL ${fail} 项`}`);
process.exit(fail === 0 ? 0 : 1);
