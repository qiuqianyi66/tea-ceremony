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
 *  4. 入口按四类分开统计（技能正文 / 路由表 README / 族 README / AGENTS.md）：
 *     只数 SKILL.md 会系统性低估「先读路由表再读技能」这条通道的使用量。
 *
 * 扫描实现统一在 scripts/lib/trajectory-scan.cjs，与 audit-skill-layering.cjs 共用一份口径。
 *
 * 用法：node scripts/audit-skill-usage-from-trajectory.cjs [--root=<sessionsDir>] [--top=15]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('./lib/trajectory-scan.cjs');

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

// 仓库范围标记：'Desktop/tea' 覆盖主树与 worktree（worktree 在 tea/.tmp 下）；
// ROOT 兜底覆盖仓库被克隆到别处的情况。缺这层会把本机其它技能根误算进本仓库。
const stats = scan({ sessionsDir: SESSIONS, repoMarks: ['Desktop/tea', ROOT] });

if (stats.missing) {
  console.log('=== 技能真实读取台账（轨迹反推）===');
  console.log(`未测：本机会话轨迹目录不存在 -> ${SESSIONS}`);
  console.log('说明：该项只在开发机可测（CI 无此目录），故只报不阻断、不进 CI。缺目录不等于零读取。');
  process.exit(0);
}

// 对照列：整行的文本提及（含正文引用），与真加载分开计
const MENTION_RE = /skills[\\/]+(?:[A-Za-z0-9_.-]+[\\/]+)?([A-Za-z0-9_.-]+)[\\/]+SKILL\.md/g;
const mentionHits = new Map();
{
  let entries = [];
  (function walk(dir) {
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'trajectory.jsonl') {
        let t = '';
        try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
        for (const m of t.matchAll(MENTION_RE)) {
          if (skillSet.has(m[1])) mentionHits.set(m[1], (mentionHits.get(m[1]) || 0) + 1);
        }
      }
    }
  })(SESSIONS);
}

// 只保留仓库态技能，避免把别处的同名目录算进来
const readHits = new Map();
for (const [n, v] of stats.skillReads) if (skillSet.has(n)) readHits.set(n, v);
// 技能根内的真实读取总数以入口分层为准；按技能名归槽会漏掉已改名/已删技能的路径
const inScope = stats.entry.skillMd;
const named = [...readHits.values()].reduce((a, b) => a + b, 0);

const all = [...skillSet.keys()];
const covered = all.filter((n) => readHits.has(n));
const never = all.filter((n) => !readHits.has(n));
const sorted = [...readHits.entries()].sort((a, b) => b[1] - a[1]);

console.log('=== 技能真实读取台账（轨迹反推）===');
console.log(`轨迹文件 ${stats.files} 个 | 有效行 ${stats.lines} 行（解析失败 ${stats.badLines}）`);
console.log(`Read 调用 ${stats.readCalls} 次，其中落在 tea 两个技能根的 ${inScope} 次`);
console.log(`  其中按技能名归槽 ${named} 次（差额为历史改名/已删技能的路径命中）`);
console.log(`仓库范围：${stats.repoMarks.join(' | ')}（不含本机其它技能根）`);
console.log(`仓库态技能 ${all.length} 个 | 被真读过 ${covered.length} 个 | 从未读过 ${never.length} 个`);
console.log(`样本足够（读了 ≥3 次）的技能 ${sorted.filter(([, v]) => v >= 3).length} 个`);
console.log('');

// 入口分层：回答「通道②到底跑过没有」
const e = stats.entry;
const s = stats.sessions;
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) : '0');
console.log('## 一、入口分层（同一批轨迹，四类入口分开计）');
console.log(`  技能正文 SKILL.md      ${e.skillMd} 次 / ${s.withSkillMd} 个会话`);
console.log(`  路由表 README（总表+分册）${e.routeReadme} 次`);
console.log(`  族 README              ${e.familyReadme} 次`);
console.log(`  → 通道②入口合计 ${e.routeReadme + e.familyReadme} 次 / ${s.withRoute} 个会话`);
console.log(`  AGENTS.md              ${e.agentsMd} 次 / ${s.withAgentsMd} 个会话`);
console.log(`  技能根其它文件         ${e.skillRootOther} 次`);
console.log(`  会话覆盖：${stats.files} 个会话里 ${s.withAny} 个读过任一入口（${pct(s.withAny, stats.files)}%），${s.withSkillMd} 个读过技能正文（${pct(s.withSkillMd, stats.files)}%）`);
console.log('  读法：AGENTS.md 被读的次数高于路由表，说明「要查路由表」这句话被看到了、路由表本身没被打开；');
console.log('  但 2026-11 起 AGENTS.md §4 已内联 14 行任务→技能速查表，路由表少读是这个改动的预期结果，不是故障。');
console.log('  真正该看的判据是「读过入口的会话里，有多少随后真读了技能正文」——见下一节。');
console.log('');

// 与活跃层交叉：分层声称「这 20 个最该被用」，轨迹可以证伪
const norm = (n) => n.replace(/^\d{2}-/, '');
const activeNames = (() => {
  const p = path.join(ROOT, 'docs/reference/skill-layering.md');
  let t = '';
  try { t = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const sec = t.split(/^## /m).find((x) => x.startsWith('活跃层'));
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

// 速查表生效度：AGENTS §4 内联「任务→技能」表之后，读了 AGENTS 的会话有没有真去读技能
const withA = stats.perSession.filter((s) => s.agents > 0);
const aThenS = withA.filter((s) => {
  const ai = s.seq.indexOf('A');
  const si = s.seq.indexOf('S');
  return ai >= 0 && si > ai;
});
console.log('## 二、速查表生效度（AGENTS.md §4 内联任务→技能表）');
console.log(`读了 AGENTS.md 的会话 ${withA.length} 个 | 其中读过技能正文 ${withA.filter((s) => s.skill > 0).length} 个 | AGENTS 先于技能 ${aThenS.length} 个`);
console.log('读法：AGENTS 先于技能的比例低，不等于速查表没用 —— 多数会话是非编码任务（分析仓库 / 整合文档 / 环境探测），');
console.log('  本来就不该读技能。要判速查表是否生效，得先按任务类型分组，样本够之前只报数不下结论。');
console.log('');

console.log('## 三、读取次数 Top ' + Math.min(TOP, sorted.length));
for (const [n, v] of sorted.slice(0, TOP)) {
  const men = mentionHits.get(n) || 0;
  console.log(`- ${n}：读 ${v} 次（文本提及 ${men} 行）`);
}
console.log('');
console.log('## 四、从未被读过（前 20）');
console.log(never.slice(0, 20).join('、') + (never.length > 20 ? ` …等 ${never.length} 个` : ''));
console.log('');
if (activeNames && activeNames.length) {
  const hit = activeNames.filter((n) => readHits.has(n));
  const miss = activeNames.filter((n) => !readHits.has(n));
  console.log(`## 四、活跃层交叉（${activeNames.length} 个）`);
  console.log(`被真读过 ${hit.length} 个；从未读过 ${miss.length} 个${miss.length ? `：${miss.join('、')}` : ''}`);
  console.log('读法：活跃层声称「这 20 个最该被用」，轨迹是反证。从未读过 + 预算占位，就是该降的信号；');
  console.log('但样本量要一起看——1~2 次谈不上稳定，别拿单次读取下结论。');
} else {
  console.log('## 五、活跃层交叉：未测（读不到 skill-layering.md 的活跃层表格）');
}
console.log('');
console.log('口径提醒：轨迹只覆盖豆包客户端会话，不含 Claude Code / Codex；"读过"不代表"读了有用"，');
console.log('也不能替代切片留痕（切片记的是「这个任务用了哪个技能」，轨迹记的是「文件被打开过」）。');
console.log('结论用途：给升降判据提供独立观测维度，不作为淘汰的唯一依据。');
