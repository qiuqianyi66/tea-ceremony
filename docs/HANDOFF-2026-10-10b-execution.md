---
name: handoff-2026-10-10b
description: 会话交接总结（2026-10-10 下午，本会话）——A4「cu 虚拟桌面」前提已证伪（截图链路 + v3 Judge 全量实跑均本地跑通）；v3 全量真实分 0.81 / judgeCoverage 1 / pass^1 37/50；分支保护 CI 门禁已补回 13 job；新发现并修复 TraceRecorder 静默丢 Trace 真 bug。取代同日 HANDOFF-2026-10-10-execution.md。
status: active
date: 2026-10-10
last_updated: 2026-10-10
owner: yanha
---

# HANDOFF · 2026-10-10b（会话交接 · 本会话）

> 本文件为最新交接，**取代 `docs/HANDOFF-2026-10-10-execution.md`**（该文件的「A4 是唯一阻塞」表述已被本会话实测推翻）。
> 跨会话主力文档 = `docs/plans/TODO-PRIORITY.md`（活文档）+ `docs/plans/PLAN-final-convergence-2026-10-09.md`（唯一执行母本）。

## 一句话现状

**无硬阻塞。** A4「cu 虚拟桌面」被证伪——截图链路和 Judge 实跑都不需要它，本会话已全部本地跑通。**v3 全量真实分已出：overall 0.81 / judgeCoverage 1 / pass^1 37/50**（简历数字现在可引用）。分支保护 CI 门禁已补回。顺带抓出并修复一个静默丢数据的真 bug。

## 本会话三件交付

### 1. A4 前提证伪（本会话最重要的发现）

「cu 虚拟桌面占用」长期被记为唯一阻塞项。实测**不成立**——所有验证链路都可用本地 headless Chromium 完成：

| 验证 | 命令 | 结果 |
|---|---|---|
| 3D 茶园四园晴雨 | `node scripts/verify-gardens.cjs` | **ERRORS: []**（8 张图已出） |
| 茶亭 | `node scripts/verify-pavilion.cjs` | **ERRORS: []** |
| 图标审计 | `node scripts/verify-icons.cjs` | **ERRORS: []** |
| 首页/成长/冲泡截图 | `screenshot-home.cjs` / `-growth.cjs` / `-brew3d.cjs` | 全部 exit 0，产物齐 |
| **v3 Judge 全量** | `node scripts/eval-tea-ai.cjs --judge --delay 13000` | **overall 0.81 / judgeCoverage 1 / pass^1 37/50** |

**结论**：K23 截图打通、P0-3 前端返工验收、v3 Judge 实跑**三项全部解锁**，不需要用户操作任何桌面。
- 关键点：截图脚本自带 `ensure-dev-server.cjs`（自动拉起 5173），`verify-*3d*` / `verify-pavilion` / `verify-gardens` 直接能跑；只有 `screenshot-home` / `screenshot-growth` 需先手起 **5174**（`npx vite --port 5174 --strictPort`）。
- 上次交接把「A4」与这三项绑在一起，是**错误归因**——实际卡的是「有没有人试着跑」，不是「cu 桌面被占」。

### 2. 分支保护 CI 门禁已补回（13 job）

- 原状态：`required_status_checks` **段缺失**（改规则解 review 死锁时被一并取消）→ PR 可带红灯合并。
- 已修复：`PUT /repos/qiuqianyi66/tea-ceremony/branches/main/protection` 整段覆盖，补回 **13 个 context**（与 ci.yml 各 job 的 `name` 逐字一致），`required_approving_review_count: 0` 保持。
- 核对：`gh api repos/qiuqianyi66/tea-ceremony/branches/main/protection -q '.required_status_checks.contexts[]'` → 期望 13 行。
- **坑**：子端点 `.../protection/required_status_checks` 在段缺失时 POST 与 PATCH **均 404**，只能整段 PUT（payload 须含 `required_status_checks` + `required_pull_request_reviews` + 其余布尔开关）。

### 3. 抓出并修复：TraceRecorder 静默丢 Trace（真 bug）

- **症状**：`ai_eval_traces` 中 **librarian 0 行**，其余 5 个 agent（chat/advisor/brewer/taster/mentor）都有；而 `ai_usage_logs` 有 librarian 调用。
- **根因**：表 `tokens_in` / `tokens_out` / `latency_ms` 是 `NOT NULL`，`LibrarianAgent` 走两参构造 `AiChatVo(content, sources)` → 这三字段为 `null` → insert 违反非空约束 → `TraceRecorder.record()` 的 catch **只落一条 `warn`** → 该次 Trace 永久丢失。旁路设计让 bug 静默。
- **后端日志铁证**：`ERROR: null value in column "tokens_in" of relation "ai_eval_traces" violates not-null constraint` + `WARN save eval trace failed`。
- **修复**：`TraceRecorder.complete()` 对三字段 null 归零（与实体默认值 `0` 一致）。
- **回归测试**：`TraceRecorderIntegrationTest.completeToleratesNullTokensFromExpertAgents`（先红后绿；红时实测 `expected: 0 but was: 120`）。
- **教训**：旁路埋点的 catch 会把「数据没落库」降级成一条 warn —— **旁路必须有"落库成功率"观测**，否则静默丢数据。已写入 ITERATIONS §附带发现。

## 当前仓库状态（2026-10-10 本会话核实）

- **main**：`fe1ec02`，与 origin/main 同步，工作区干净。
- 分支保护：`required_status_checks` 13 context ✅ / `approvals = 0` ✅ / force-push 禁 ✅。
- worktree：`tea`（main）、`tea-garden-s1`（feature/garden-s1，已合可删）、`tea-testing`（prunable）。
- 迁移 V1-V6；ADR 001-018；CI 13 job；`.agents/skills` 66 / `.harness/skills` 33。
- 后端容器 `tea-backend-1` healthy（18080→8080），DB `tea-db-1` healthy，AI key 生效（真实调用有回复）。
- `verify-harness.cjs` / `audit-redlines.cjs` / `audit-wiki-drift.cjs` 全绿；后端 `mvn test` **211 tests 全绿**。

## v3 全量真实分（简历可引用）

```
overall 0.81 | 结果质量 0.77 | 过程质量 0.79 | 安全稳定 1.00
judgeCoverage 1（全量真实，非 program-only）| pass^1 37/50
programOnly 0.86（同批 program 口径）| 效率 avgLatency 6710ms / in 176 / out 228 tokens
```

失败 13/50，三类根因（详见 `docs/ai-eval/ITERATIONS.md` §v3 归因）：

1. **判分器与产品设计冲突（5 条）**：ADV-001/002 回答质量达标但 `sources=0`，判分器把「RAG 未命中」当失败——而 librarian 提示词明确允许「未命中则常识作答」。**判分口径要改，产品没问题**。
2. **评测集缺 `precondition: no-records`（6 条）**：taster/mentor 在无品鉴记录时返回「请先完成一次品鉴记录」是正确防御，却是按"有记录"预设期望 → 判 0。
3. **边缘输入关键词匹配（2 条）**：CHA-006 乱码 / ADV-007 超长走友好引导，考点关键词未命中。

**v4 应修**：①判分器区分「未命中但有合格常识回答」；②评测集补前置态标注；③mentor 提示词补六境引导（MEN-001 自 v1 遗留）。

## 已完成（历史，防重做）

| 块 | 内容 | commit |
|---|---|---|
| Graph 决策 | ADR-018 暂缓（四维甄别 0/4）+ 教材精读实测反驳 | 1b64bdd |
| F-6 会话配额 | AiCallQuota 按 sessionId + QuotaExceededException(429) + Trace 复杂度档位 | ec7e8f4 |
| 前端会话迁移 | teaAI 登录态分流（sessionId/后端 anchor）+ 429 清会话 + setup.ts polyfill | 29d8d31 |
| 评测判分真实性 | judge 未回填计 0 + programOnly/judgeCoverage 口径 | b9f083a |
| PR 流程 | PR #41 PR-only 约定；PR #42 handoff 同步 | 7f3e6cc / fe1ec02 |

## 恢复指针（新对话第一步）

1. 读 `docs/plans/TODO-PRIORITY.md` + `docs/plans/PLAN-final-convergence-2026-10-09.md` + 本文件。
2. **不要再等 A4**——它已被证伪（见上）。需要跑验证直接跑，脚本自己起 dev server。
3. 可直接做：**v4 评测迭代**（三类根因修复，见上）、Q1 真实用户试用（PWA 部署，v3 分数已达标）、T15 C6 低优先甄别、D 系列低优先项、K17-K22。
4. 改完走 PR-only：`fix/xxx` 或 `feature/xxx` 分支 → push（22 端口）→ PR → **13 job 全绿**（门禁已恢复，不会再放行红灯）→ 合并。

## 本会话已交付物

- `fix/trace-tokens-null` 分支（TraceRecorder null tokens 修复 + 回归测试）。
- `docs/ai-eval/ITERATIONS.md`：v3 行 + 全量口径说明 + v3 归因 + 附带发现的产品 bug。
- `docs/plans/TODO-PRIORITY.md`：状态速览刷新（A4 证伪、CI 门禁补回、Trace bug）、A 段「无硬阻塞」、命令表补齐截图端口与分支保护。
- 本文件：最新交接（取代 `docs/HANDOFF-2026-10-10-execution.md`）。
- v3 报告：`docs/ai-eval/reports/2026-10-10.json`。
