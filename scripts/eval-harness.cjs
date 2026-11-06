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
const { execSync, execFileSync } = require('child_process');

// review.md 结论解析（纯函数，node --test 覆盖）：取文末最后一个 🔴…🟡 计数行判清零。
// 评审惯例 Findings 区先列「🔴 0 条 / 🟡 N 条（已修复）」摘要，清零结论在文末 Verdict 区；
// 取首个匹配会把发现摘要误当结论（#147 修复的 bug，回归锁见 scripts/tests/eval-harness.node-test.cjs）。
function parseReviewClean(text) {
  if (!text) return false;
  const ms = [...text.matchAll(/🔴\s*(?:(?<rnum>\d+)|(?:零|无))[^🟡]*?🟡\s*(?:(?<ynum>\d+)|(?:零|无))/g)];
  const m = ms.at(-1);
  return m ? Number(m.groups.rnum ?? 0) === 0 && Number(m.groups.ynum ?? 0) === 0 : false;
}

/**
 * docs/agent-eval 报告必须自带元信息头。
 * 为什么写进生成器而不是事后手补：本文件每次运行都整体重写报告，手补的 frontmatter 会被下一次
 * 评估覆盖，verify-harness 的 doc-meta 警告随后复现（gate-reliability 切片实测踩过）。
 */
function metaHeader(date) {
  return ['---', `last_updated: ${date}`, 'status: active', 'owner: yanha', '---', ''].join('\n');
}

/**
 * ADR 是否适用 / 是否满足——只用文件证据判定，不匹配 summary 正文措辞。
 * 旧实现用 /架构|ADR|迁移|数据模型/ 匹配 summary 文本，于是「**无**数据库迁移」里的「迁移」
 * 被当成 ADR 证据，给一个没有 ADR 的切片打了 ADR:✓（gate-reliability 实测假阳性）。
 *
 * 残留盲区（按路径证据原理不可判定，不假装覆盖）：语义级数据变更若不动 entity/迁移文件
 * （例如只改 repository 里的 SQL 字符串），本判据看不到，仍需人工评审兜底。
 */
function touchesSchemaPath(f) {
  return (
    /(^|\/)db-migrations\.sql$/.test(f) ||
    /(^|\/)rollback\.sql$/.test(f) ||
    /flyway|(^|\/)migrations?\//i.test(f) ||
    /\/entity\//i.test(f) ||
    /^src\/services\/storage\/db\.ts$/.test(f) // 前端 Dexie 表结构（AGENTS §8 的 L3）
  );
}

/**
 * 内容级数据模型判定：SQL/DDL 关键词。用于补「路径不可见的语义级数据变更」盲区
 * （只改 repository 内 SQL 或 service 内表语义、不动 entity/迁移文件时）。
 * 保守：只在测试文件以外 + 已确认存在该文件时判定，避免误伤纯逻辑 service。
 */
const SQL_KEYWORDS_RE = /\b(CREATE\s+(UNIQUE\s+)?(TABLE|INDEX|VIEW|SEQUENCE)|ALTER\s+(TABLE|INDEX|VIEW|SEQUENCE|DATABASE|SCHEMA)|DROP\s+(TABLE|INDEX|VIEW|SEQUENCE)|TRUNCATE\s+TABLE|RENAME\s+TABLE|MERGE\s+INTO|REPLACE\s+INTO|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|SELECT\s+[\w,.\s]+\s+FROM)\b/i;
function touchesSchemaContent(fileText) {
  return SQL_KEYWORDS_RE.test(fileText);
}

function adrVerdict(changedFiles) {
  const hasAdr = changedFiles.some((f) => f.startsWith('docs/ADR/'));
  const touchesSchema = changedFiles.some(touchesSchemaPath);
  // 内容级补盲：文件内容含 SQL/DDL 关键词时也算 schema 触面（补路径不可见的语义级数据变更）
  const touchesSchemaSql =
    !touchesSchema &&
    changedFiles.some((f) => {
      try {
        const p = path.resolve(root, f);
        if (!fs.existsSync(p) || /__tests__|(\.spec|\.test)\.[cm]?[jt]sx?$/.test(f)) return false;
        return touchesSchemaContent(fs.readFileSync(p, 'utf8'));
      } catch {
        return false;
      }
    });
  return { applicable: hasAdr || touchesSchema || touchesSchemaSql, ok: hasAdr, touchesSchema: touchesSchema || touchesSchemaSql };
}

/**
 * 「零迁移」判定：文件证据优先于 summary 措辞，冲突时按文件判并把冲突写进 note。
 * 旧实现只看 summary 措辞，于是 summary 写了「无数据库迁移」而同 commit 里带迁移/实体的切片
 * 会被豁免（m1-ai / m1-auth 实测）。
 */
function deriveNoMigrate(changedFiles, summaryText) {
  const declared = /无(数据库)?迁移|零迁移|无迁移/.test(summaryText);
  if (!changedFiles.length) return { value: declared, conflict: false };
  const sqlInFiles = changedFiles.some((f) => /(^|\/)db-migrations\.sql$/.test(f));
  return { value: declared && !sqlInFiles, conflict: declared && sqlInFiles };
}

/** 解析 git -z（NUL 分隔）输出 */
function splitNul(out) {
  return out
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean);
}

// R1 修复：root 必须在模块顶层，否则被 require 时 adrVerdict 的内容级分支会抛 ReferenceError
const root = path.resolve(__dirname, '..');

/**
 * 通过判定：总分达线 **且** 安全零违规 **且** 安全维真有证据。
 * 为什么安全不参与加权补偿：safety 权重仅 0.08，安全归零时其余六维满分仍有 92 分——
 * 违规会被平均掉，"总分 ≥60" 于是能放行带安全违规的切片。四类指标须分开判，不揉总分。
 * 为什么没证据不算过（三态语义，对齐 skillkit SK-05「未验证不得标 PASS」）：
 * 切片无可归属 commit 时安全维没扫到任何东西，那是「未验证」而非「合规」，不能计入通过。
 */
function judgePass(totalInt, safetyScore, safetyVerified = true) {
  // 只有「已取证且查出违规」才一票否决。未取证是「没查」，不是「查过且合规」也不是「违规」——
  // 若把未取证也否决，任何无可归属 commit 的历史切片都会永久红（假红），门禁变成永远挡住 CI 的死门。
  // 「未取证」的痕迹由安全维 note 显式标注，不允许读者把它读成已查过。
  const safetyViolation = safetyVerified && safetyScore < 100;
  return !safetyViolation && totalInt >= 60;
}

module.exports = {
  parseReviewClean,
  metaHeader,
  adrVerdict,
  touchesSchemaPath,
  touchesSchemaContent,
  deriveNoMigrate,
  judgePass,
};

if (require.main === module) {
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

// 切片归属的文件证据：只看本切片各 commit 实际改了什么（参数走 execFileSync，不经 shell 拼接；
// -c core.quotePath=false + -z 保证中文路径与空格路径不被转义/拆分，本地与 CI 同口径）
const BATCH_COMMIT_FILE_LIMIT = 50;
let changedFiles = [];
let attributionNote = '';
try {
  const gitOut = (args) =>
    execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  const commits = gitOut(['log', '--format=%H', '--', `.harness/changes/${slice}`]).split('\n').filter(Boolean);
  if (commits.length > 20) attributionNote = `；切片共 ${commits.length} 个 commit，只取最近 20 个判 ADR`;
  for (const c of commits.slice(0, 20)) {
    const files = splitNul(gitOut(['show', '--name-only', '--format=', '-z', c]));
    // 批量提交（一次改几十上百个文件）无法把文件归给单个切片，算进来会串味：跳过并留痕
    if (files.length > BATCH_COMMIT_FILE_LIMIT) {
      attributionNote += `；commit ${c.slice(0, 7)} 改了 ${files.length} 个文件（批量），归属存疑已跳过`;
      continue;
    }
    changedFiles.push(...files);
  }
} catch (e) {
  // git 不可用：不给分也不静默通过——写进 note，让报告自己暴露这次没证据
  attributionNote = `；git 不可用（${String(e.message).split('\n')[0]}），ADR 记 n/a 不给分`;
}

const noMigrateInfo = deriveNoMigrate(changedFiles, summaryText);
const noMigrate = noMigrateInfo.value;
if (noMigrateInfo.conflict) {
  attributionNote += '；summary 声明「无迁移」但切片 commit 里含 db-migrations.sql，已按文件判为有迁移';
}

// ---- 1. 流程完整性 22%：必需产物文件存在性（文件系统不说谎） ----
{
  const checks = [
    ['summary.md', fs.existsSync(path.join(ch, 'summary.md'))],
    ['db-migrations.sql', fs.existsSync(path.join(ch, 'db-migrations.sql'))],
    ['rollback.sql', fs.existsSync(path.join(ch, 'rollback.sql'))],
    ['review.md', fs.existsSync(path.join(ch, 'review.md'))],
  ];
  // 零迁移切片：迁移两个文件豁免（豁免要在报告里看得见，否则读报告的人以为文件真存在）
  const effective = checks.map(([n, ok]) => {
    if (noMigrate && (n === 'db-migrations.sql' || n === 'rollback.sql')) return [n, true, '零迁移豁免'];
    return [n, ok, ok ? '存在' : '缺失'];
  });
  const adr = adrVerdict(changedFiles);
  const passed = effective.filter(([, ok]) => ok).length;
  const adrWeight = adr.applicable ? 1 : 0;
  scores.process = Math.round((passed + (adr.ok ? 1 : 0)) / (effective.length + adrWeight) * 100);
  note(
    '流程完整性',
    scores.process,
    effective.map(([n, ok, d]) => `${n}:${ok ? '✓' : '✗'}${d === '存在' ? '' : `(${d})`}`).join(' ') +
      ` ADR:${adr.applicable ? (adr.ok ? '✓' : '✗（本切片触数据模型/迁移但无 docs/ADR）') : 'n/a（本切片未触数据模型/迁移）'}` +
      attributionNote,
  );
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

// ---- 5. 安全合规 8%：路径级检测本切片路径 + 内容级检测新增行密钥/.env ----
// 口径收窄为「本切片归属文件」（changedFiles）。旧实现扫 `git diff HEAD~5` 全仓，历史 commit 里
// 任何一次正则误报都会永久否决后续所有切片（zz-usage-probe 实测总分 67 却被判「安全违规」）。
let safetyEvidence = false;
{
  let violations = 0;
  const files = [...new Set(changedFiles)];
  safetyEvidence = files.length > 0;
  if (files.some((f) => /node_modules\/|__pycache__\/|\.venv\/|test-results\/|playwright-report\/|^dist\//m.test(f))) {
    violations++;
  }
  if (files.length) {
    try {
      const rawDiff = execFileSync(
        'git',
        ['-c', 'core.quotePath=false', 'diff', 'HEAD~5', '--', ...files, ':(exclude)package-lock.json', ':(exclude)pnpm-lock.yaml'],
        { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
      );
      // 只看「新增行」：删除一行含明文口令的测试夹具是在**清理**凭据，不是引入（本切片实测误报）
      const added = rawDiff
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .join('\n');
      if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|password\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]|api[_-]?key\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]|secret\s*[:=]\s*(?!(?:\$\{|\}|[a-zA-Z_$][\w$]*))["']?[^\s"'$}=]/i.test(added)) violations++;
      if (/^\+\s*\.env(?![.\w])/m.test(rawDiff)) violations++;
    } catch { /* diff 不可用时仅路径级判定 */ }
  }
  scores.safety = violations === 0 ? 100 : Math.max(0, 100 - violations * 40);
  // 无归属 commit 时 safety 记满分但必须留「未取证」痕迹，禁止让读者读成「已查过且合规」
  const evidence = files.length ? '' : '（本切片无可归属 commit，安全维未取证）';
  note('安全合规', scores.safety, violations === 0 ? `无密钥/禁目录/.env 提交${evidence}` : `发现 ${violations} 类违规`);
}

// ---- 6. 迭代能力 5%：review 清零 + 修复提交 ----
{
  const review = path.join(ch, 'review.md');
  const clean = fs.existsSync(review) ? parseReviewClean(fs.readFileSync(review, 'utf8')) : false;
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
const pass = judgePass(totalInt, scores.safety, safetyEvidence);
// 总分够但被否决时给出原因，否则读者只看到「92 分却 FAIL」以为脚本坏了
// 未取证不再是否决位（见 judgePass 注释），所以此处只剩「总分达标但安全有违规」一种情形
const vetoHint = !pass && totalInt >= 60 ? '（安全项否决：总分达标但存在违规）' : '';

// 用本地日期，不用 toISOString()：UTC 会在大夜班时段写成前一天，与 commit 日期对不上
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const lines = [
  metaHeader(today),
  `# eval-harness: ${slice}`,
  '',
  `> 确定性评测（零 LLM）。--verify=${verify ? 'on' : 'off'}。日期 ${today}`,
  '',
];
for (const n of notes) {
  lines.push(`| ${n.d} | ${n.s}/100 | ${n.e} |`);
}
lines.push('', `**总分: ${totalInt}/100（≥60 通过）— ${pass ? 'PASS' : 'FAIL'}**${vetoHint}`, '');

console.log(`\neval-harness: ${slice} (verify=${verify ? 'on' : 'off'})\n`);
for (const n of notes) console.log(`${n.s >= 60 ? '✅' : '❌'} ${n.d}: ${n.s}/100 — ${n.e}`);
console.log(`\n总分: ${totalInt}/100 ${pass ? 'PASS' : 'FAIL'}${vetoHint}`);

const outDir = path.join(root, 'docs', 'agent-eval');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${slice}-eval.md`), lines.join('\n'));
process.exit(pass ? 0 : 1);
}

