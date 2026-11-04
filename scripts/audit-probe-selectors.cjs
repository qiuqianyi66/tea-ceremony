#!/usr/bin/env node
/**
 * audit-probe-selectors.cjs — 探针死选择器审计
 *
 * 治的病：探针（scripts/verify-*.cjs）引用了前端已删除/改名的节点，于是它「跑得过、但验不到」，
 * 还会打印一句看着像通过的结论。这个坑已发生两次（T4.1 删除种植/浇水链路后，
 * verify-water* / verify-controls / verify-field / verify-garden-3d-crop / verify-garden-sync-e2e
 * 仍在使用 .plant-btn-3d / .tea-select-item / .dialog-btn / .plant-detail）。
 *
 * 判据：把探针里出现的字面选择器拆成 token，逐个回 `src/` 源码里找字面命中，命中 0 次即判红。
 *   - class   `.x`            → 查 `x` 是否出现在 src 源码
 *   - id      `#x`            → 查 `id="x"` / `id='x'` 或 `x` 字面
 *   - 属性值  `[attr="v"]`    → 查 `attr="v"` 整对是否出现（只验属性名不验值会漏报）
 *   - 模糊    `[attr*="v"]`   → 同上去引号查 v
 *   - title   `[title="v"]`   → 同上（按属性值规则）
 * 明确不覆盖：运行时拼接的选择器（`page.locator('#' + id)`、模板插值 `` `.item-${i}` ``）——
 * 插值会被跳过并计入「未覆盖」清单打印出来，不静默装作验过。
 *
 * 为什么用「字面命中」而非 DOM 实测：探针要能在没有 dev server 的 CI 里跑（harness-consistency job
 * 不跑 npm ci / 不起服务），且 Vue 模板里的 class / id / title 都是字面量，误报风险低。
 *
 * 已知局限（写清，不假装覆盖）：token 命中是**全仓**判定——同一个 class 只要在别的组件里存在，
 * 本路由下已删除的用法就查不出来（需要「路由 → 组件可达性」分析，不在本审计范围）。
 *
 * 豁免：确实必须引用「当前源码不存在」的选择器时，在探针顶部写
 * `// PROBE-ALLOW: <理由 ≥8 字且 ≥6 个文字/数字>`。豁免是**预算不是通道**（与红线 R2 同规）：
 * 全仓 ≤ PROBE_ALLOW_BUDGET 处，同一理由不得 ≥2 处，每次运行打印每处理由。
 *
 * 输出契约：`ERRORS: [...]` + 退出码（与 audit-redlines.cjs 同族）。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, 'scripts');

/** 探针里取选择器的方法名（Playwright 常用面；漏掉的方法名会形成盲区，新增用法时补这里） */
const METHOD_RE = '(?:locator|click|isVisible|waitForSelector|fill|hover|dblclick|selectOption|isChecked|isDisabled|\\$\\$?|getByTestId|getByText|getByRole)';

// 三种引号分别匹配：单/双引号里允许出现另一种引号（如 '[title="浇水"]'）。
// 用一条 [^'"`]+ 会把这种属性选择器整段漏掉（实测漏报）。
const SEL_RE_LIST = [
  new RegExp(`${METHOD_RE}\\(\\s*'((?:\\\\.|[^'\\\\])*)'`, 'g'),
  new RegExp(`${METHOD_RE}\\(\\s*"((?:\\\\.|[^"\\\\])*)"`, 'g'),
  new RegExp(`${METHOD_RE}\\(\\s*\`((?:\\\\.|[^\`\\\\])*)\``, 'g'),
];
const ALLOW_RE = /\/\/\s*PROBE-ALLOW:\s*([^\n]*)/;
const MIN_ALLOW_REASON = 8;
const MIN_ALLOW_WORD_CHARS = 6;
/** 豁免预算（与 .harness/rules/编码规范.md 的 R2 同思路：豁免是预算不是通道） */
const PROBE_ALLOW_BUDGET = 3;
/** 同一理由出现达到此次数即报红 */
const SAME_REASON_LIMIT = 2;

function normalizeReason(raw) {
  const cleaned = raw.replace(/[\s*/]+$/, '').trim();
  if (cleaned.length < MIN_ALLOW_REASON) return null;
  if ((cleaned.match(/[\p{L}\p{N}]/gu) ?? []).length < MIN_ALLOW_WORD_CHARS) return null;
  return cleaned;
}

/** 拆 token：class / id / 属性名值对。返回 { tokens: string[], dynamic: boolean } */
function extractTokens(sel) {
  const dynamic = /\$\{/.test(sel);
  const tokens = [];
  for (const c of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) tokens.push({ kind: 'class', needle: c[1] });
  for (const i of sel.matchAll(/#([A-Za-z][\w-]*)/g)) tokens.push({ kind: 'id', needle: i[1] });
  // [attr="v"] / [attr='v'] / [attr] / [attr*="v"]
  for (const a of sel.matchAll(/\[([\w-]+)(?:[*^$~|]?=)?\s*["']?([^\]"']*)["']?\]/g)) {
    const name = a[1];
    const value = (a[2] || '').trim();
    if (value) tokens.push({ kind: 'attr', needle: `${name}="${value}"`, loose: value });
    else tokens.push({ kind: 'attr', needle: name, loose: null });
  }
  // getByTestId('x') / getByText('x') 这类方法传的是值不是选择器：整段字面查一次
  if (!tokens.length && !dynamic && /^[\w-]+$/.test(sel)) tokens.push({ kind: 'value', needle: sel });
  return { tokens, dynamic };
}

/**
 * 从一段探针源码里找出「引用了 src 不存在节点」的选择器（纯函数，供 node --test 覆盖）。
 * @returns {{dead: string[], dynamic: string[]}}
 */
function findDeadSelectors(scriptText, srcText) {
  const dead = [];
  const dynamic = [];
  const seen = new Set();
  for (const re of SEL_RE_LIST) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(scriptText))) {
      const sel = m[1];
      if (seen.has(sel)) continue;
      seen.add(sel);
      const parsed = extractTokens(sel);
      if (parsed.dynamic) {
        dynamic.push(sel);
        continue;
      }
      const missing = parsed.tokens.filter((t) =>
        t.kind === 'attr' && t.loose ? !srcText.includes(t.loose) : !srcText.includes(t.needle),
      );
      if (missing.length) {
        dead.push(`选择器 ${sel} 在 src/ 命中 0 次（${missing.map((t) => `${t.kind}:${t.loose ?? t.needle}`).join(' / ')}）`);
      }
    }
  }
  return { dead, dynamic };
}

function collectSourceText() {
  const acc = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      // 排除测试目录：测试里的选择器常是替身，纳入会掩盖真实节点被删
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (/\.(vue|ts|css|scss|html)$/.test(e.name)) acc.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(root, 'src'));
  return acc.join('\n');
}

function main() {
  const errors = [];
  const exempted = [];
  const dynamicSelectors = [];
  const srcText = collectSourceText();
  const scripts = fs.readdirSync(scriptsDir).filter((n) => n.endsWith('.cjs') && n !== 'audit-probe-selectors.cjs');
  const reasonCount = new Map();

  for (const file of scripts) {
    const text = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
    const allow = ALLOW_RE.exec(text);
    const reason = allow ? normalizeReason(allow[1]) : null;
    if (allow && !reason) {
      errors.push(`${file}:PROBE-ALLOW 理由不合格（需 ≥${MIN_ALLOW_REASON} 字且含 ≥${MIN_ALLOW_WORD_CHARS} 个文字/数字）`);
      continue;
    }
    if (reason) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    const { dead, dynamic } = findDeadSelectors(text, srcText);
    for (const d of dynamic) dynamicSelectors.push(`${file} ${d}`);
    for (const item of dead) {
      const line = `${file} ${item}`;
      if (reason) exempted.push(`${line}「${reason}」`);
      else errors.push(line);
    }
  }

  // 豁免预算与同因阈值：超出即红（防「写一行注释永久静音整个探针」）
  if (exempted.length > PROBE_ALLOW_BUDGET) {
    errors.push(`PROBE-ALLOW 豁免 ${exempted.length} 处，超出预算 ${PROBE_ALLOW_BUDGET} 处`);
  }
  for (const [reason, n] of reasonCount) {
    if (n >= SAME_REASON_LIMIT) errors.push(`同一豁免理由出现 ${n} 处「${reason.slice(0, 24)}…」，需改为通用解`);
  }

  if (exempted.length) {
    console.log(`⚠ PROBE-ALLOW 豁免 ${exempted.length}/${PROBE_ALLOW_BUDGET} 处（理由须是「为什么必须引用不存在的节点」）：`);
    for (const e of exempted) console.log(`   - ${e}`);
  }
  if (dynamicSelectors.length) {
    console.log(`ℹ 动态拼接选择器 ${dynamicSelectors.length} 处未参与判定（本审计明确不覆盖，需人工确认）：`);
    for (const d of dynamicSelectors) console.log(`   - ${d}`);
  }
  console.log('ERRORS:', JSON.stringify(errors));
  if (errors.length) process.exitCode = 1;
}

module.exports = { findDeadSelectors, extractTokens, normalizeReason, PROBE_ALLOW_BUDGET };

if (require.main === module) main();
