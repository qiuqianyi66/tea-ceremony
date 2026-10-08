---
last_updated: 2026-10-08
status: draft
owner: yanha
---

# PLAN — harness 修复（G1/G3/§6）+ P0-1b 会话记忆（2026-10）

> 依据：`docs/research-harness-audit-2026-10-08.md`（体检报告）+ `docs/prd/P0-1b-chat-memory-requirements-2026-10-08.md`（需求+架构样例）。本 PLAN 为阶段 1 产物，**经用户批准后才执行**。

## Goal

经用户批准后，执行 4 项任务：G3 修复 §11 路径错误；G1 eval-harness 挂 CI；§6 增量建议并入既有 PLAN；P0-1b 会话记忆（ChatMemoryService）后端落地。全部完成时：CI 13 job 变 14（或原 job 内加一步）、mvn test 全绿、api-contract 登记会话端点、AGENTS.md 无已知漂移、工作区无未提交。

## Context

- 现状事实（均已核实）：ai_chat_sessions/ai_messages 表已建（Flyway V3）无实体；AiChatService.chat() 无状态；eval-harness 未挂 CI（ci.yml:264-281 harness-consistency 仅 3 脚本）；AGENTS.md §11 `py_compile app/main.py` 路径错（main.py 在 backend/ 根）；体检 §6 建议未并入 docs/PLAN-harness-research-2026-10.md。
- 承重墙：`teaAI.ts` 降级链三分支、chat 接口向后兼容（sessionId 可空）、`ddl-auto: validate` 列名对齐。
- 依赖：无 AI key 依赖（降级路径验证）；不依赖截图环境（P3-4 只卡 P0-3）。

## Risk Assessment

```yaml
risk:
  T1-G3: 2 LOW        # Impact1 单点 + Scope1 单文件 + Uncertainty0 + Irreversibility0
  T2-G1: 4 MEDIUM     # Impact1 单点 + Scope2 跨模块(ci.yml+§11) + Uncertainty1(eval 参数) + Irreversibility0(易回退)
  T3-§6: 3 LOW        # Impact1 + Scope1 + Uncertainty1(并入方式) + Irreversibility0
  T4-P0-1b: 9 HIGH    # Impact3 多模块 + Scope3 跨系统(实体/服务/端点/wiki/chat接入) + Uncertainty2(key缺失端到端受限) + Irreversibility1(新增代码可回滚)
  evidence:
    - reason: P0-1b 触碰后端分层+契约+承重墙边界，是本次最大风险面
      affected_area: backend ai 域、api-contract wiki、AiChatService 接入点
      possible_failure: 实体列名与 V3 不符启动失败（validate 红线）；降级路径丢用户消息
    - reason: T2 动 CI 门禁，防误阻断
      affected_area: .github/workflows/ci.yml harness-consistency job
      possible_failure: eval 切片选取不当导致 CI 常红
```

总体 9 = HIGH → Controlled Track（与用户点名一致）。

## Approach

- 执行序：T1(G3) → T2(G1) → T3(§6) 三个快赢先行（相互独立），T4(P0-1b) 大块殿后。
- T4 垂直切片（AGENTS.md §9 tracer bullet）：实体 → Repository → Service → Controller → api-contract 登记 → AiChatService 接入 → 测试（每片端到端可验证）。
- T3 并入方式待 O-1 拍板：建议新增「2026-10-08 体检增量」节 + 既有表补行，不重构既有结构。
- 架构级决策（T4 若新增端点/改契约）执行后写 ADR 或更新 CONTEXT.md 关键词（按 AGENTS.md §12 惯例）。

## Tasks

| # | Task | Input | Action | Output | Validation |
|---|---|---|---|---|---|
| T1 | G3 §11 路径修复 | AGENTS.md §11 | `py_compile app/main.py` → `python -m py_compile main.py` | 单行改 | L0：`Test-Path backend/main.py` = True；命令可执行 |
| T2 | G1 eval 挂 CI | ci.yml L264-281 + eval-harness.cjs | harness-consistency job 加 eval step（切片选取见 O-5）；§11 命令入口同步语义 | ci.yml 一步 + AGENTS.md §11 补一行 | L2：本地跑 eval-harness 全绿；`npx actionlint` 或 yaml 语法校验；verify-harness 不破 |
| T3 | §6 并入 PLAN | research-harness-audit §6 + docs/PLAN-harness-research-2026-10.md | 按 O-1 拍板方式并入（新增节 + 补行） | PLAN 文件更新 | L0：verify-harness.cjs ERRORS: []（ADR/路径/技能数不破） |
| T4 | P0-1b ChatMemoryService | V3 DDL + AiChatService + 需求文档 §8 样例 | 实体×2 → Repo×2 → ChatMemoryService(接口+实现) → Controller 4 端点 → api-contract 登记 → chat 接入 sessionId → 单测 | 后端新文件 + wiki 登记行 + 接入 diff | L2：`mvn -q test` 全绿（含 ArchUnit 层测试自动覆盖）；F-1~F-10 验收逐条过；降级路径冒烟（无 key 时 F-8） |

## Trade-offs

- sessionId 可选 vs 必填：选可选（前端零改动、承重墙不动）；代价：无 sessionId 时无记忆，但那是现状行为。
- 锚定条数固定 20 vs 按 tokens：选固定（tokens 列在无 AI key 时 null，不可依赖）。
- 端点含 DELETE vs 最小集：建议含（CASCADE 现成，F-4 成本 1 方法）。
- 消息写入幂等：不加 client_id（不动表，L2 边界内）；重复提交由前端控制（本次前端不改，接受该缺口，记 Not Doing）。

## Rollback Strategy

- 每任务独立 commit（conventional commits：fix(harness) / chore(docs) / feat(ai)）。
- T1/T2/T3：`git revert` 单 commit 即可。
- T4：新增文件整体删除；AiChatService 仅一处接入点（+record 一字段），revert 即恢复无状态；端点下线即断。无数据迁移、无破坏性 DDL（不动表）。

## Open Questions（需用户拍板，禁止 TBD 掩饰）

- **O-1**：§6 并入方式——新增独立节（建议，既有表不动）vs 合并进既有 P0/P1 表？
- **O-2（=D-1）**：sessionId 放 AiChatRequest 可空字段（建议）vs 独立参数？
- **O-3（=D-4）**：DELETE 会话端点是否本次范围（建议含）？
- **O-4（=D-2）**：历史锚定条数上限（建议 20）？
- **O-5**：T2 的 eval 切片选取——扫描 docs/agent-eval/ 最新报告 vs 硬编码指定切片？
- **O-6（=D-3）**：topic 缺省 = 首条 user 消息前 20 字（建议）vs 空？

## Not Doing

- 前端 UI 会话列表/历史回看；`teaAI.ts` 改动（sessionId 前端接入留后续）；IndexedDB 会话表与同步；游客会话；向量检索/embedding（P0-1c）；消息编辑/摘要/定时清理；任何表结构迁移（client_id 幂等列等，L3）；AI key 依赖；截图验证环境处理（P3-4 独立项）。
