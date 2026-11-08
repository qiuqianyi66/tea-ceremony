#!/usr/bin/env node
/**
 * 技能真实读取台账 —— 从客户端会话轨迹反推「哪些技能真被读过」
 *
 * 为什么需要它：audit-skill-usage 只能看 .harness/changes/<切片>/summary.md 里人填的「调用技能」，
 * 39 个切片只有 1 个填了，升降判据因此长期卡在「未测」。轨迹是机器记录，不受人是否记得填影响。
 *
 * 口径（三条，缺一条结论就会错）：
 *  1. 只统计 Read 工具调用的 file_path —— 这是真加载；正文里的文本提及另计一列，两列不可混。
 *  2. 只认 tea 仓库两个技能根（.agents/skills、.harness/skills）内的 SKILL.md。
 *  3. 轨迹目录不存在时输出「未测」并 exit 0，**不得报 0**（把没测到读成正常是本机制最致命的失败模式）。
 *     该目录只在开发机存在，CI 没有，所以本脚本只报不阻断、不进 CI。
 *
 * 用法：node scripts/audit-skill-usage-from-trajectory.cjs [--root=<sessionsDir>] [--top=15]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPDATA_LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const DEFAULT_SESSIONS = path.join(
  APPDATA_LOCAL, 'Doubao', 'User Data', 'Default', '.doubao', 'agent_mode', 'workspace', '.sessions',
);
const argv = process.argv.slice(2);
const argOf = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const SESSIONS = argOf('root') || DEFAULT_SESSIONS;
const TOP = Number(argOf('top') || 15);

// 仓库态技能清单（两个根的目录名 + 路径）
const SKILL_DIRS = [
  ['agents', path.join(ROOT, '.agents', 'skills')],
  ['harness', path.join(ROOT, '.harness', 'skills')],
];
const skillSet = new Map();
for (const [root, dir] of SKILL_DIRS) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const probe = root === 'agents'
      ? path.join(dir, e.name, 'SKILL.md')
      : null;
    if (root === 'agents') {
      if (fs.existsSync(probe)) skillSet.set(e.name, root);
    } else {
      // .harness/skills/<family>/<skill>/SKILL.md
      for (const f of fs.readdirSync(path.join(dir, e.name), { withFileTypes: true })) {
        if (f.isDirectory() && fs.existsSync(path.join(dir, e.name, f.name, 'SKILL.md'))) {
          skillSet.set(f.name.replace(/^\d{2}-/, ''), root);
        }
      }
    }
  }
}

if (!fs.existsSync(SESSIONS)) {
  console.log('=== 技能真实读取台账（轨迹反推）===');
  console.log(`未测：本机会话轨迹目录不存在 -> ${SESSIONS}`);
  console.log('说明：该项只在开发机可测（CI 无此目录），故只报不阻断、不进 CI。缺目录不等于零读取。');
  process.exit(0);
}

// 递归找 trajectory.jsonl
const files = [];
(function walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'trajectory.jsonl') files.push(p);
  }
})(SESSIONS);

const readHits = new Map();   // 真 Read 加载
const mentionHits = new Map(); // 仅文本提及（对照列）
let lines = 0, badLines = 0, readCalls = 0, readCallsInScope = 0;

const SKILL_PATH_RE = /Desktop\/tea\/(\.agents|\.harness)\/skills\/(?:[^/]+?\/)?([A-Za-z0-9_.-]+)\/SKILL\.md/g;
const MENTION_RE = /skills[\\/]+(?:[A-Za-z0-9_.-]+[\\/]+)?([A-Za-z0-9_.-]+)[\\/]+SKILL\.md/g;

for (const f of files) {
  let text = '';
  try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim()) continue;
    lines += 1;
    // 对照列：整行的文本提及（含正文引用），与真加载分开计
    for (const m of rawLine.matchAll(MENTION_RE)) {
      const n = m[1];
      if (skillSet.has(n)) mentionHits.set(n, (mentionHits.get(n) || 0) + 1);
    }
    let obj;
    try { obj = JSON.parse(rawLine); } catch { badLines += 1; continue; }
    for (const tc of obj.tool_calls || []) {
      const fn = tc.function || tc;
      if (fn.name !== 'Read') continue;
      readCalls += 1;
      let args = fn.arguments;
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch { continue; } }
      const fp = args && (args.file_path || args.path);
      if (typeof fp !== 'string') continue;
      const norm = fp.replace(/\\/g, '/');
      for (const m of norm.matchAll(SKILL_PATH_RE)) {
        const n = m[2].replace(/^\d{2}-/, '');
        readCallsInScope += 1;
        readHits.set(n, (readHits.get(n) || 0) + 1);
      }
    }
  }
}

const all = [...skillSet.keys()];
const covered = all.filter((n) => readHits.has(n));
const never = all.filter((n) => !readHits.has(n));
const sorted = [...readHits.entries()].sort((a, b) => b[1] - a[1]);

console.log('=== 技能真实读取台账（轨迹反推）===');
console.log(`轨迹文件 ${files.length} 个 | 有效行 ${lines} 行（解析失败 ${badLines}）`);
console.log(`Read 调用 ${readCalls} 次，其中落在 tea 两个技能根的 ${readCallsInScope} 次`);
console.log(`仓库态技能 ${all.length} 个 | 被真读过 ${covered.length} 个 | 从未读过 ${never.length} 个`);
console.log(`样本足够（读了 ≥3 次）的技能 ${sorted.filter(([, v]) => v >= 3).length} 个`);
console.log('');
// 与活跃层交叉：分层声称「这 20 个最该被用」，轨迹可以证伪
const norm = (n) => n.replace(/^\d{2}-/, '');
const activeNames = (() => {
  const p = path.join(ROOT, 'docs/reference/skill-layering.md');
  let t = '';
  try { t = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const sec = t.split(/^## /m).find((s) => s.startsWith('活跃层'));
  if (!sec) return null;
  const out = new Set();
  for (const line of sec.split('\n')) {
    if (!line.startsWith('|') || /^\|[\s:|-]+\|?$/.test(line)) continue;
    // 取表格最后一列（技能列），按顿号/逗号切；用技能集合校验，避免把族名（main-dev）或
    // 以数字开头的名字（18-3d-scene）漏掉或误收
    const cells = line.split('|').slice(1, -1);
    const last = (cells[cells.length - 1] || '').trim();
    for (const raw of last.split(/[、,，]/)) {
      const n = norm(raw.trim());
      if (skillSet.has(n)) out.add(n);
    }
  }
  return [...out];
})();

console.log('## 读取次数 Top ' + Math.min(TOP, sorted.length));
for (const [n, v] of sorted.slice(0, TOP)) {
  const men = mentionHits.get(n) || 0;
  console.log(`- ${n}：读 ${v} 次（文本提及 ${men} 行）`);
}
console.log('');
console.log('## 从未被读过（前 20）');console.log(never.slice(0, 20).join('、') + (never.length > 20 ? ` …等 ${never.length} 个` : ''));
console.log('');
if (activeNames && activeNames.length) {
  const hit = activeNames.filter((n) => readHits.has(n));
  const miss = activeNames.filter((n) => !readHits.has(n));
  console.log(`## 活跃层交叉（${activeNames.length} 个）`);
  console.log(`被真读过 ${hit.length} 个；从未读过 ${miss.length} 个${miss.length ? `：${miss.join('、')}` : ''}`);
  console.log('读法：活跃层声称「这 20 个最该被用」，轨迹是反证。从未读过 + 预算占位，就是该降的信号；');
  console.log('但样本量要一起看——1~2 次谈不上稳定，别拿单次读取下结论。');
} else {
  console.log('## 活跃层交叉：未测（读不到 skill-layering.md 的活跃层表格）');
}
console.log('');
console.log('口径提醒：轨迹只覆盖豆包客户端会话，不含 Claude Code / Codex；"读过"不代表"读了有用"，');
console.log('也不能替代切片留痕（切片记的是「这个任务用了哪个技能」，轨迹记的是「文件被打开过」）。');
console.log('结论用途：给升降判据提供独立观测维度，不作为淘汰的唯一依据。');
