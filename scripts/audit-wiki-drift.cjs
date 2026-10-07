#!/usr/bin/env node
/**
 * wiki 契约漂移审计（替代 .claude/agents/consistency-verifier 的接口维度，豆包运行时等效）。
 *
 * 比对 .harness/wiki/api-contract.md 登记的端点 vs 后端代码实际路由：
 *   新栈：backend/src/main/java 下所有 Controller.java（@RequestMapping 类前缀 + 方法注解）
 *   旧栈：backend/app/routers/*.py（相对路径 + 挂载前缀映射）
 * 归一化 {path_var} → {p}、去尾部斜杠后逐段匹配。
 *   wiki 登记但代码缺失      = ERROR（契约漂移，文档或实现过期）
 *   代码存在但 wiki 未登记    = WARNING（新端点需登记契约）
 *
 * 已知跳过：/mcp（SSE+JSON-RPC，非 HTTP JSON 契约）、/、/health（系统端点）。
 *
 * 用法：node scripts/audit-wiki-drift.cjs   期望输出 ERRORS: []
 * 有漂移 exit 1（可挂 CI），无漂移 exit 0。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

// 旧栈 routers 文件 → 挂载前缀（app/main.py include_router 挂载点）
const PY_PREFIX = {
  teas: '/api/teas', teawares: '/api/teawares', records: '/api/records',
  culture: '/api/culture', auth: '/api/auth', ai: '/api/ai',
};

function norm(p) {
  let s = p.replace(/\/+$/, '');                    // 去尾部斜杠
  s = s.replace(/\{[^}]+\}/g, '{p}');               // 路径变量归一化
  return s;
}
function segments(p) { return norm(p).split('/').filter(Boolean); }
function matches(wikiSegs, codeSegs) {
  if (wikiSegs.length !== codeSegs.length) return false;
  for (let i = 0; i < wikiSegs.length; i++) {
    if (wikiSegs[i] !== codeSegs[i] && codeSegs[i] !== '{p}') return false;
  }
  return true;
}

// ---------- 1. 提取 wiki 登记端点 ----------
const wiki = fs.readFileSync(path.join(ROOT, '.harness/wiki/api-contract.md'), 'utf8');
const wikiEndpoints = [];
for (const m of wiki.matchAll(/\|\s*(POST|GET|PUT|DELETE|PATCH)\s*\|\s*`(\/api\/[^`]+)`/g)) {
  const p = norm(m[2]);
  if (!p.startsWith('/api/')) continue;
  // 区块标注检查：端点到上一个 ### 标题之间若含"未实现/待实现"，契约明确留白，跳过
  const headIdx = wiki.lastIndexOf('### ', m.index);
  const blockStart = headIdx >= 0 ? headIdx : 0;
  const blockText = wiki.slice(blockStart, m.index);
  if (/未实现|待实现/.test(blockText)) continue;
  wikiEndpoints.push({ method: m[1], path: p, line: wiki.slice(0, m.index).split('\n').length });
}

// ---------- 2. 收集代码端点 ----------
const codeEndpoints = [];   // {path, source}

// 新栈 Spring Boot：类级 @RequestMapping + 方法注解（注解可带路径也可裸用）
function walkDir(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkDir(path.join(dir, e.name), acc);
    else if (e.name.endsWith('.java')) acc.push(path.join(dir, e.name));
  }
}
const javaFiles = [];
walkDir(path.join(ROOT, 'backend/src/main/java'), javaFiles);
for (const f of javaFiles) {
  const text = fs.readFileSync(f, 'utf8');
  const clsMatch = text.match(/@RequestMapping\("([^"]+)"\)/);
  const clsPrefix = clsMatch ? norm(clsMatch[1]) : '';
  if (clsPrefix && !clsPrefix.startsWith('/api')) continue;   // 非 API 控制器跳过
  for (const m of text.matchAll(/@(Get|Post|Put|Delete|Patch)Mapping(?:\("([^"]*)"\))?/g)) {
    const mpRaw = m[2] === undefined ? '' : m[2].replace(/\/+$/, '');
    let full;
    if (mpRaw.startsWith('/api')) full = norm(mpRaw);          // 绝对路径注解
    else if (clsPrefix) {
      if (mpRaw === '') full = norm(clsPrefix);                // 裸注解：类级路径
      else if (mpRaw.startsWith('/')) full = norm(clsPrefix + mpRaw);  // 相对类前缀
      else full = norm(clsPrefix + '/' + mpRaw);
    } else continue;
    if (full.startsWith('/api')) codeEndpoints.push({ path: full, source: path.relative(ROOT, f).replace(/\\/g, '/') });
  }
}

// 旧栈 FastAPI：相对路径 + 挂载前缀
for (const [fname, prefix] of Object.entries(PY_PREFIX)) {
  const pf = path.join(ROOT, 'backend/app/routers', fname + '.py');
  if (!fs.existsSync(pf)) { warnings.push(`旧栈 routers/${fname}.py 缺失（api-contract.md 登记的前缀 ${prefix} 无实现）`); continue; }
  const text = fs.readFileSync(pf, 'utf8');
  for (const m of text.matchAll(/@router\.(get|post|put|delete|patch)\("([^"]*)"/g)) {
    let full;
    const mp = m[2].replace(/\/+$/, '');
    if (mp === '' || mp === '/') full = norm(prefix);
    else full = norm(prefix + '/' + mp.replace(/^\/+/, ''));
    if (full.startsWith('/api')) codeEndpoints.push({ path: full, source: path.relative(ROOT, pf).replace(/\\/g, '/') });
  }
}

// ---------- 3. 双向核对 ----------
const codePaths = new Set(codeEndpoints.map(c => c.path));
for (const w of wikiEndpoints) {
  const ws = segments(w.path);
  const found = [...codePaths].some(cp => matches(ws, segments(cp)));
  if (!found) {
    errors.push(`wiki 登记端点未在代码中找到：${w.path}（api-contract.md 第 ${w.line} 行；契约或实现过期，改契约先改本文件）`);
  }
}
const wikiPaths = new Set(wikiEndpoints.map(w => w.path));
const unregistered = [];
for (const c of codeEndpoints) {
  if (![...wikiPaths].some(w => matches(segments(w), segments(c.path)))) {
    unregistered.push(`${c.path}（${c.source}）`);
  }
}
for (const u of unregistered.slice(0, 5)) {
  warnings.push(`代码端点未登记契约：${u}（新增端点需先在 api-contract.md 登记）`);
}
if (unregistered.length > 5) warnings.push(`代码端点未登记契约：另有 ${unregistered.length - 5} 个（同上，需登记）`);

// ---------- 输出 ----------
console.log('=== wiki 契约漂移审计（替代 consistency-verifier） ===');
console.log(`wiki 登记端点 ${wikiEndpoints.length} 个 | 代码端点 ${codeEndpoints.length} 个`);
for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length === 0) {
  console.log('ERRORS: []');
  process.exit(0);
}
for (const e of errors) console.log(`❌ ${e}`);
console.log(`ERRORS: [${errors.length}]`);
process.exit(1);
