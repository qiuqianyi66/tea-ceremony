---
name: handoff-2026-10-10
description: 会话交接总结（2026-10-10）——全局最新状态：PR-only 流程已启用（PR #41 走通）、评测判分口径已修正（v1/v2 为 program-only，勿用旧数字）、F-6 会话配额已上、ADR-018 Graph 暂缓；当前唯一阻塞 A4（cu 虚拟桌面）。
status: active
date: 2026-10-10
last_updated: 2026-10-10
owner: yanha
---

# HANDOFF · 2026-10-10（会话交接）

> 本文件为最新交接。上一份 HANDOFF-2026-10-09-execution.md 已过时（其"S1 未开工"表述已被推翻）。跨会话主力文档 = `docs/plans/TODO-PRIORITY.md`（活文档）+ `docs/plans/PLAN-final-convergence-2026-10-09.md`（当前唯一执行母本）。

## 一句话现状
所有主线已收敛：**PR-only 流程已启用并走通（PR #41）**、茶园 S1 已合 main（PR #40）、AI key 已启用、**F-6 会话配额（429）已上**、**ADR-018 判定 Graph 暂缓**；当前按 final-convergence（T01-T15）推进，**唯一阻塞 = A4（cu 虚拟桌面）**。

## ⚠️ 最高优先：判分口径已修正，旧数字作废
- v1 **0.82** / v2 **0.96** 均为 **program-only 口径**（judge off；未回填的 judge 考点原计"中性 1"）。
- 改为「未回填计 0」后同批 dry-run：**overall = 0.19，programOnly = 1**——98 考点中 **77 个是 judge（78.6%）从未被判**。
- **简历/汇报引用前必须跑 v3**：`node scripts/eval-tea-ai.cjs --judge --delay 13000`（50 条 × 2 次调用，约 20 分钟）。
- 报告已加 `programOnly` / `judgeCoverage` 双口径字段；ITERATIONS.md 已加口径警告。

## 推送流程（2026-10-10 变更，务必遵守）
- main 设了 PR 保护 → **一律走分支 + PR**：`feature/xxx|fix/xxx|chore/xxx` → push → 开 PR → **CI 13 job 全绿** → 合并。
- **禁再直推 main**（AGENTS.md §13 已沉淀此约定）。
- `required_approving_review_count: 0`（死锁已解）。
- ⚠️ **待补**：分支保护的 `required_status_checks` 被一并取消 → **CI 门禁当前失效**（PR 可带红灯合并）。建议补回 13 个 job。
- push 走 22 端口：`$env:GIT_SSH_COMMAND="ssh -o HostName=github.com -o Port=22"`。

## 仓库状态（2026-10-10 已核实）
- **main**：**`7f3e6cc`**，与 origin/main 同步。
- worktree 3 个：`tea`（main）、`tea-garden-s1`（feature/garden-s1，已合可删）、`tea-testing`（prunable）。
- 迁移：V1__init / V2__culture_seed / V3__agent_memory / V4__garden_energy / V5__ai_eval_traces / V6__agent_skills。
- ADR：001-018（014 ArchUnit / 015 garden / 016 ai eval trace / 017 agent skills / **018 Graph 暂缓 + AI 配额**）。

## 已完成（本轮会话交付）
| 块 | 内容 | commit |
|---|---|---|
| Graph 决策 | ADR-018 暂缓（四维甄别 0/4）+ 教材精读实测反驳（research 文档） | 1b64bdd |
| F-6 会话配额 | AiCallQuota 按 sessionId + QuotaExceededException(429) + Trace 复杂度档位 + 修 login-max 缩进 | ec7e8f4 |
| 前端会话迁移 | teaAI 登录态分流（登录走 sessionId/后端 anchor，游客保留本地 history）+ 429 清会话 + setup.ts localStorage polyfill | 29d8d31 |
| 评测判分真实性 | judge 未回填计 0 + programOnly/judgeCoverage 口径 + calibrate UNKNOWN 分账 + ITERATIONS 标注 | b9f083a |
| PR 流程 | PR #41（PR-only 约定）+ 分支保护 review 死锁解除 | 7f3e6cc |

## 阻塞 / 待办
- **A4（唯一阻塞，需用户操作）**：cu 虚拟桌面占用 → 解锁 K23 截图打通、P0-3 前端返工验收、**v3 Judge 全量实跑**。
- **新待办**：补回分支保护的 CI 状态检查门禁（13 job）。
- **B 可直接开工**：T15 C6 低优先甄别；Q1 PWA 真实用户试用。
- **D 低优先**：K17-K22、P1-5/6/7/9/10、技术债（mcp 双版本、启动 WARN）。
- **T05/T06 仍阻塞**：Judge 全量 + 校准实跑受容器出网 TLS 拦截（环境级，非代码）——换网络或宿主直跑（改 `--base-url`）。

## 关键事实（防重做）
- **判分器口径**：对"未判"必须计 0 而非中性（0.96 假象 → 实为 0.19）。
- **Graph**：Mermaid 图对 ≠ 行为对，验收须断言实际执行节点集合；不配 Executor 照样并行。
- **前端会话**：quota 需登录 + sessionId 才生效；teaAI 匿名调用不计数（已知设计，非 bug）。
- **localStorage/Node 25**：vitest jsdom 下 `globalThis.localStorage` 被 Node 实验性对象 shadow（方法 undefined）→ setup.ts 已加内存 polyfill。
- **容器出网 TLS**：nc → getent → openssl s_client → 宿主 SslStream 对比；清空 compose 代理无效（已回滚）。

## 恢复指针（新对话第一步）
1. 读 `docs/plans/TODO-PRIORITY.md` + `docs/plans/PLAN-final-convergence-2026-10-09.md`。
2. 确认 **A4（cu 虚拟桌面）**——唯一卡点。
3. 无 A4 依赖可做：补 CI 门禁、T15 C6 甄别、Q1 PWA 部署、D 低优先项。

## 本会话（我）已交付物
- `docs/ADR/ADR-018.md`：Graph 暂缓决策。
- `docs/research-spring-ai-alibaba-graph-2026-10.md`：教材精读 + 实测反驳（§9 是最可信的实测结论）。
- `docs/prd/REQ-graph-introduce-2026-10-09.md`、`docs/prd/REQ-ai-session-quota-2026-10-09.md`：需求分析。
- `docs/plans/PLAN-graph-decision-2026-10-09.md`、`docs/plans/PLAN-ai-session-quota-2026-10-09.md`：方案。
- 本文件：最新交接。
- 上一版 `docs/HANDOFF-2026-10-09-execution.md` 已过时，本文件取代。
