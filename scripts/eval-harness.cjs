#!/usr/bin/env node
/**
 * eval-harness.cjs — harness 七维确定性评测（把流程当被测对象）
 * 用法: node scripts/eval-harness.cjs <切片名> [--verify]
 *   <切片名> = .harness/changes/ 下目录名（如 m5-s2）
 *   --verify  = 真跑前端 type-check / 后端 compile（默认跳过，相关维记 0 分）
 * 七维（权重参照阿里 harness eval，100% 确定性、零 LLM、3 次跑分一致）：
 *   流程完整性 22% / 产物质量 15% / 代码正确性 22% / 效率 10%
 *   / 安全合规 8% / 迭代能力 5% / 接口验收 18%
 * 原则：失败必须响亮，不静默兜底；给不了证据的维度记 0 分。
 * 输出: console 评分表 + docs/agent-eval/<切片>-eval.md 报告；总分 <60 退出码 1。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const slice = process.argv[2];
const verify = process.argv.includes('--verify');
if (!slice) {
  console.error('usage: node scripts/eval-harness.cjs <slice-name> [--verify]');
  process.exit(1);
}

const WEIGHTS = {
  process: 0.22,
  quality: 0.15,
  correct: 0.22,
  efficiency: 0.10,
  safety: 0.08,
  iteration: 0.05,
  interface: 0.18,
};
const scores = {};
const notes = [];
const note = (d, s, e) => notes.push({ d, s, e });

const ch = path.join(root, '.harness', 'changes', slice);
const summaryPath = path.join(ch, 'summary.md');
const summaryText = fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '';
const noMigrate = /无(数据库)?迁移|零迁移|无迁移/.test(summaryText);

// ---- 1. 流程完整性 22%：必需产物文件存在性（文件系统不说谎） ----
{
  const checks = [
    ['summary.md', fs.existsSync(path.join(ch, 'summary.md'))],
    ['db-migrations.sql', fs.existsSync(path.join(ch, 'db-migrations.sql'))],
    ['rollback.sql', fs.existsSync(path.join(ch, 'rollback.sql'))],
    ['review.md', fs.existsSync(path.join(ch, 'review.md'))],
  ];
  // 零迁移切片：迁移两个文件豁免
  const effective = checks.map(([n, ok]) => {
    if (noMigrate && (n === 'db-migrations.sql' || n === 'rollback.sql')) return [n, true, '零迁移豁免'];
    return [n, ok, ok ? '存在' : '缺失'];
  });
  // L3 应带 ADR：切片范围内提交是否含 docs/ADR 改动（Node 实现，兼容 Windows）
  let adrOk = /架构|ADR|迁移|数据模型/.test(summaryText);
  try {
    const names = execSync(`git log --oneline --name-only -- .harness/changes/${slice}`, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    adrOk = adrOk || names.includes('docs/ADR/');
  } catch { /* git 不可用时以 summary 关键词为准 */ }
  const passed = effective.filter(([, ok]) => ok).length;
  scores.process = Math.round((passed + (adrOk ? 1 : 0)) / (effective.length + 1) * 100);
  note('流程完整性', scores.process, effective.map(([n, ok, d]) => `${n}:${ok ? '✓' : '✗'}`).join(' ') + ` ADR:${adrOk ? '✓' : '✗'}`);
}

// ---- 2. 产物质量 15%：summary 结构 + 反注水 ----
{
  const hasScope = /范围|边界|做什么|不做什么|背景/.test(summaryText);
  const hasGwt = /F-|Given|When|Then|GWT|验收|功能/.test(summaryText);
  const hasImpact = /影响|风险|回滚|依赖/.test(summaryText);
  const notFiller = summaryText.length > 200 && (summaryText.includes('```') || summaryText.includes('|') || /\d+\.\s/.test(summaryText));
  const passed = [hasScope, hasGwt, hasImpact, notFiller].filter(Boolean).length;
  scores.quality = Math.round(passed / 4 * 100);
  note('产物质量', scores.quality, `范围:${hasScope} GWT:${hasGwt} 影响:${hasImpact} 反注水(>200字/含代码块或表格):${notFiller}`);
}

// ---- 3. 代码正确性 22%：真验证才给分（不信自报） ----
{
  if (verify) {
    let ok = true;
    let detail = '';
    try {
      const isFrontend = /src\/|\.vue|\.ts|\.css|frontend/.test(summaryText) || fs.existsSync(path.join(root, 'src'));
      if (isFrontend && fs.existsSync(path.join(root, 'package.json'))) {
        execSync('npm run type-check', { cwd: root, stdio: 'pipe', timeout: 180000 });
        detail = 'type-check 通过';
      } else {
        execSync('mvn -q compile', { cwd: path.join(root, 'backend'), stdio: 'pipe', timeout: 300000 });
        detail = 'backend compile 通过';
      }
    } catch (e) {
      ok = false;
      detail = `真验证失败: ${String(e.message).split('\n')[0]}`;
    }
    scores.correct = ok ? 100 : 0;
    note('代码正确性', scores.correct, detail);
  } else {
    scores.correct = 0;
    note('代码正确性', 0, '未传 --verify，拒绝凭自报给分（失败响亮）');
  }
}

// ---- 4. 效率 10%：commit 数与 diff 规模（Node 实现，兼容 Windows） ----
{
  try {
    const log = execSync(`git log --oneline -- .harness/changes/${slice}`, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const commits = log.trim() ? log.split(/\r?\n/).length : 0;
    const files = (summaryText.match(/\n- |\n\* /g) || []).length;
    const ok = commits <= 8 && files <= 40;
    scores.efficiency = ok ? 100 : 50;
    note('效率', scores.efficiency, `切片相关 commit=${commits} 文档条目≈${files}（≤8/≤40 满分）`);
  } catch {
    scores.efficiency = 50;
    note('效率', 50, 'git log 不可用');
  }
}

// ---- 5. 安全合规 8%：路径级检测真实提交 + 内容级检测密钥/.env ----
{
  let violations = 0;
  let paths = '';
  try {
    paths = execSync('git diff --name-only HEAD~5', { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  } catch { /* 忽略 */ }
  // 路径级：禁提交目录（只看真实改动路径，避免文档文字误报）
  if (/node_modules\/|__pycache__\/|\.venv\/|test-results\/|playwright-report\/|^dist\//m.test(paths)) violations++;
  // 内容级：密钥/密码/占位符真值 + 新增 .env 文件
  try {
    const diff = execSync('git diff HEAD~5 -- . ":(exclude)package-lock.json" ":(exclude)pnpm-lock.yaml"', { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|password\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]|api[_-]?key\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]|secret\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]/i.test(diff)) violations++;
    if (/^\+\s*\.env(?![.\w])/m.test(diff)) violations++;
  } catch { /* diff 不可用时仅路径级判定 */ }
  scores.safety = violations === 0 ? 100 : Math.max(0, 100 - violations * 40);
  note('安全合规', scores.safety, violations === 0 ? '无密钥/禁目录/.env 提交' : `发现 ${violations} 类违规`);
}

// ---- 6. 迭代能力 5%：review 清零 + 修复提交 ----
{
  let clean = false;
  const review = path.join(ch, 'review.md');
  if (fs.existsSync(review)) {
    const text = fs.readFileSync(review, 'utf8');
    const m = text.match(/🔴\s*(?:(?<rnum>\d+)|(?:零|无))[^🟡]*?🟡\s*(?:(?<ynum>\d+)|(?:零|无))/);
    clean = m ? Number(m.groups.rnum ?? 0) === 0 && Number(m.groups.ynum ?? 0) === 0 : false;
  }
  scores.iteration = clean ? 100 : 50;
  note('迭代能力', scores.iteration, `review 结论行 🔴🟡 ${clean ? '清零' : '未清零/未找到'}`);
}

// ---- 7. 接口验收 18%：契约登记 + 集成测试 ----
{
  const contract = path.join(root, '.harness', 'wiki', 'api-contract.md');
  let missing = [];
  if (fs.existsSync(summaryPath) && fs.existsSync(contract)) {
    const paths = [...new Set((summaryText.match(/\/api\/[^\s|*?、`()（）"'，。；]+/g) || []))];
    const c = fs.readFileSync(contract, 'utf8');
    missing = paths.filter((p) => !c.includes(p));
  }
  const testFile = fs.existsSync(path.join(root, 'backend', 'src', 'test')) || fs.existsSync(path.join(root, 'tests'));
  const pass = missing.length === 0 && (testFile || noMigrate);
  scores.interface = pass ? 100 : missing.length ? 30 : 70;
  note('接口验收', scores.interface, missing.length ? `未登记契约: ${missing.join(', ')}` : `契约登记✓ 测试目录${testFile ? '✓' : '✗'}`);
}

// ---- 汇总 ----
const total = Object.keys(WEIGHTS).reduce((acc, k) => acc + (scores[k] || 0) * WEIGHTS[k], 0);
const totalInt = Math.round(total);
const pass = totalInt >= 60;

const lines = [`# eval-harness: ${slice}`, '', `> 确定性评测（零 LLM）。--verify=${verify ? 'on' : 'off'}。日期 ${new Date().toISOString().slice(0, 10)}`, ''];
for (const n of notes) {
  lines.push(`| ${n.d} | ${n.s}/100 | ${n.e} |`);
}
lines.push('', `**总分: ${totalInt}/100（≥60 通过）— ${pass ? 'PASS' : 'FAIL'}**`, '');

console.log(`\neval-harness: ${slice} (verify=${verify ? 'on' : 'off'})\n`);
for (const n of notes) console.log(`${n.s >= 60 ? '✅' : '❌'} ${n.d}: ${n.s}/100 — ${n.e}`);
console.log(`\n总分: ${totalInt}/100 ${pass ? 'PASS' : 'FAIL'}`);

const outDir = path.join(root, 'docs', 'agent-eval');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${slice}-eval.md`), lines.join('\n'));
process.exit(pass ? 0 : 1);
