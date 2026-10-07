#!/usr/bin/env node
/**
 * 红线机械化审计（替代 .claude/agents/red-line-auditor，豆包运行时等效）。
 *
 * 依据 .harness/rules/编码规范.md §五红线清单（15 条），把可机械判定的
 * 子集做成确定性门禁；不可判定的条目输出人工核对提示，不静默跳过。
 *
 * 机械化子集：
 *   R2  吞异常：catch(Exception/RuntimeException) 空块
 *   R7  ddl-auto: update/create 禁生产；.harness/changes 迁移与回滚成对
 *   R8  禁 Executors 快捷工厂（newFixedThreadPool 等）
 *   R9  密钥禁入库（git 跟踪 .env/pem/secrets/credentials.json）；禁 console 打印密钥字段
 *   R10 前端禁直连第三方 AI（api.openai.com / dashscope 等域名，须走后端 /api/ai/*）
 *   R11 禁 Options API（data()/methods:/computed:）；禁显式 any / @ts-ignore
 *   R12 views → stores → services 单向（stores 禁 import views；services 禁 import stores/views）
 *   R14 禁直接创建 WebGLRenderer（统一 TresJS）
 * 人工核对：R1（ArchUnit 已机械化）/ R3 / R5 / R6 / R13 / R15（CI 门禁覆盖）
 *
 * 用法：node scripts/audit-redlines.cjs   期望输出 ERRORS: []
 * 有违规 exit 1（可挂 CI），无违规 exit 0。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

// 遍历目录收集文件（排除构建产物/依赖/版本目录）
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.venv', 'test-results', 'playwright-report', 'secrets', 'target', '__pycache__']);
function walkDir(dir, acc, exts) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walkDir(path.join(dir, e.name), acc, exts);
    } else if (exts.has(path.extname(e.name).toLowerCase())) {
      acc.push(path.join(dir, e.name));
    }
  }
}
function collect(relRoot, exts) {
  const acc = [];
  const abs = path.join(ROOT, relRoot);
  if (fs.existsSync(abs)) walkDir(abs, acc, exts);
  return acc;
}
// 去掉行首空白后判断是否注释行
function isComment(line, lang) {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  if (lang === 'vue' && (t.startsWith('<!--') || t.startsWith('-->'))) return true;
  if (lang === 'py' && t.startsWith('#')) return true;
  return false;
}
function readLines(p) { try { return fs.readFileSync(p, 'utf8').split(/\r?\n/); } catch { return []; } }
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

// ---------- R2：吞异常（Java 空 catch 块） ----------
const javaFiles = collect('backend/src/main/java', new Set(['.java']));
const swallowCatch = [];
for (const f of javaFiles) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/catch\s*\(\s*(Exception|RuntimeException)\s+\w+\s*\)\s*\{\s*[\r\n\s]*\}/g)) {
    swallowCatch.push(`${rel(f)}: catch(${m[1]}) 空块吞异常`);
  }
}
for (const s of swallowCatch) errors.push(`R2 ${s}（编码规范 §五 R2：禁 catch 吞异常）`);

// ---------- R7a：ddl-auto 非 validate（跳过 # 注释行） ----------
const cfgFiles = collect('backend', new Set(['.properties', '.yml', '.yaml']));
const ddlAuto = [];
for (const f of cfgFiles) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('#')) continue;
    const m = lines[i].match(/ddl-auto\s*[:=]\s*(update|create|create-drop)/);
    if (m) ddlAuto.push(`${rel(f)}:${i + 1} ddl-auto=${m[1]}（禁生产，R7）`);
  }
}
for (const d of ddlAuto) errors.push(`R7 ${d}（编码规范 §五 R7：Schema 变更只走 Flyway）`);

// ---------- R7b：迁移成对（.harness/changes 每切片 db-migrations.sql + rollback.sql） ----------
const changesDir = path.join(ROOT, '.harness/changes');
if (fs.existsSync(changesDir)) {
  const slices = fs.readdirSync(changesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_template').map(d => d.name);
  for (const s of slices) {
    const up = path.join(changesDir, s, 'db-migrations.sql');
    const down = path.join(changesDir, s, 'rollback.sql');
    const hasUp = fs.existsSync(up);
    const hasDown = fs.existsSync(down);
    if (hasUp !== hasDown) {
      errors.push(`R7 .harness/changes/${s}/ 迁移未成对（${hasUp ? '有 db-migrations.sql 缺 rollback.sql' : '有 rollback.sql 缺 db-migrations.sql'}，R7：迁移必须成对可回滚）`);
    }
  }
}

// ---------- R8：Executors 快捷工厂 ----------
const executorsHits = [];
for (const f of javaFiles) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Executors\.(newFixedThreadPool|newCachedThreadPool|newSingleThreadExecutor|newScheduledThreadPool)\b/);
    if (m && !isComment(lines[i], 'java')) executorsHits.push(`${rel(f)}:${i + 1} Executors.${m[1]}（R8：统一有界线程池）`);
  }
}
for (const e of executorsHits) errors.push(`R8 ${e}`);

// ---------- R9a：密钥禁入库（git 跟踪敏感文件） ----------
try {
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);
  const secretFiles = tracked.filter(p => {
    const n = p.replace(/\\/g, '/');
    return /(^|\/)\.env$/i.test(n) || /\.env\.(?!example|template|local\.example)[a-z0-9]+$/i.test(n)
      || /\.pem$/i.test(n) || /(^|\/)secrets\//i.test(n) || /credentials\.json$/i.test(n);
  });
  for (const s of secretFiles) errors.push(`R9 敏感文件被 git 跟踪：${s}（.env/pem/secrets/credentials 禁入库，R9）`);
} catch { warnings.push('R9a 无法读取 git 跟踪清单（git 不可用，跳过文件入库检查）'); }

// ---------- R9b：console 打印密钥字段 ----------
const tsLike = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue', '.java', '.py']);
const secPattern = /console\.(log|info|debug)\s*\([^)]*(password|passwd|secret|api[_-]?key|authorization|bearer)[^)]*\)/i;
const secErrPattern = /console\.error\s*\([^)]*(password|passwd|secret|api[_-]?key|authorization|bearer)[^)]*\)/i;
const secHits = [];
const frontendFiles = collect('src', tsLike);
const backendScriptFiles = collect('backend/app', tsLike);
for (const f of [...frontendFiles, ...backendScriptFiles]) {
  const lines = readLines(f);
  const lang = path.extname(f).toLowerCase() === '.vue' ? 'vue' : path.extname(f).toLowerCase() === '.py' ? 'py' : 'js';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line, lang)) continue;
    const m = line.match(secPattern);
    if (m) { secHits.push(`${rel(f)}:${i + 1} console 打印密钥字段（${m[1]}）`); continue; }
    const me = line.match(secErrPattern);
    if (me) warnings.push(`R9 ${rel(f)}:${i + 1} console.error 含密钥字段（${me[1]}，核对是否脱敏）`);
  }
}
for (const s of secHits) errors.push(`R9 ${s}（密钥禁入日志，R9）`);

// ---------- R10：前端禁直连第三方 AI ----------
const AI_HOSTS = /(api\.openai\.com|api\.anthropic\.com|api\.deepseek\.com|dashscope\.aliyuncs\.com|generativelanguage\.googleapis\.com)/i;
const aiHits = [];
for (const f of frontendFiles) {
  const lines = readLines(f);
  const lang = path.extname(f).toLowerCase() === '.vue' ? 'vue' : 'js';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line, lang)) continue;
    if (AI_HOSTS.test(line)) aiHits.push(`${rel(f)}:${i + 1} 直连第三方 AI 域名（R10：AI 请求必须走后端 /api/ai/*）`);
  }
}
for (const a of aiHits) errors.push(`R10 ${a}`);

// ---------- R11a：Options API ----------
const vueFiles = collect('src', new Set(['.vue']));
const optionsApiHits = [];
for (const f of vueFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const exportIdx = text.search(/export\s+default\s*\{/);
  if (exportIdx < 0) continue;
  const tail = text.slice(exportIdx, exportIdx + 400);
  if (/\bdata\s*\(|methods\s*:|computed\s*:/.test(tail)) {
    optionsApiHits.push(`${rel(f)}: export default 含 data()/methods:/computed:（R11：禁 Options API，用 script setup）`);
  }
}
for (const o of optionsApiHits) errors.push(`R11 ${o}`);

// ---------- R11b：显式 any / ts-ignore ----------
const tsFiles = collect('src', new Set(['.ts', '.tsx', '.vue']));
const anyHits = [];
for (const f of tsFiles) {
  const lines = readLines(f);
  const lang = path.extname(f).toLowerCase() === '.vue' ? 'vue' : 'js';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line, lang)) continue;
    if (/:\s*any\b|as\s+any\b|@ts-ignore|@ts-nocheck/.test(line)) {
      anyHits.push(`${rel(f)}:${i + 1} ${line.trim().slice(0, 60)}`);
    }
  }
}
for (const a of anyHits) errors.push(`R11 ${a}（R11：禁显式 any / ts-ignore）`);

// ---------- R12：数据流反向（views → stores → services） ----------
// 白名单：src/services/http.ts → stores/ui 是全局错误 toast 的横切模式
// （handleHttpError 用 ui.showToast 提示 403/404/500），属架构性例外，禁删。
const FLOW_EXCEPTIONS = new Set(['src/services/http.ts']);
const storeFiles = collect('src/stores', new Set(['.ts']));
const serviceFiles = collect('src/services', new Set(['.ts']));
const flowHits = [];
const storeViews = [];
for (const f of storeFiles) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/from\s+['"](\.[^'"]*\/)?views\/[^'"]*['"]/);
    if (m && !isComment(lines[i], 'js')) storeViews.push(`${rel(f)}:${i + 1} store 引用 views（R12：数据流单向）`);
  }
}
const svcReverse = [];
for (const f of serviceFiles) {
  const lines = readLines(f);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/from\s+['"]([^'"]*(stores|views)\/)[^'"]*['"]/);
    if (m && !isComment(lines[i], 'js')) svcReverse.push(`${rel(f)}:${i + 1} services 引用 ${m[2]}（R12：数据流单向）`);
  }
}
for (const s of [...storeViews, ...svcReverse]) {
  if (!FLOW_EXCEPTIONS.has(s.slice(0, s.indexOf(':')))) flowHits.push(s);
}
for (const h of flowHits) errors.push(`R12 ${h}`);

// ---------- R14：禁直接创建 renderer ----------
const rendererHits = [];
for (const f of [...vueFiles, ...collect('src', new Set(['.ts', '.js']))]) {
  const lines = readLines(f);
  const lang = path.extname(f).toLowerCase() === '.vue' ? 'vue' : 'js';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line, lang)) continue;
    if (/new\s+(THREE\.)?WebGLRenderer\s*\(/.test(line)) {
      rendererHits.push(`${rel(f)}:${i + 1} 直接创建 WebGLRenderer（R14：统一 TresJS）`);
    }
  }
}
for (const r of rendererHits) errors.push(`R14 ${r}`);

// ---------- 人工核对提示（不可机械判定的红线） ----------
warnings.push('人工核对（不可机械化）：R1 分层（ArchUnit 已机械化）/ R3 四层对象分离 / R5 幂等 client_id / R6 N+1 与分页 / R13 设计门禁 / R15 部署门禁（CI 13 job 覆盖）');

// ---------- 输出 ----------
console.log('=== 红线机械化审计（替代 red-line-auditor） ===');
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length === 0) {
  console.log('ERRORS: []');
  process.exit(0);
}
for (const e of errors) console.log(`❌ ${e}`);
console.log(`ERRORS: [${errors.length}]`);
process.exit(1);
