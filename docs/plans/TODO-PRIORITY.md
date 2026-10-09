---
last_updated: 2026-10-09
status: active
owner: yanha
---

# TODO-PRIORITY — 一盏茶 待办与跨会话状态总览（活文档）

> 用途：跨会话状态交接，替代压缩摘要的不确定性。新会话先读本文件，再开工。
> 维护规则：状态变化当场更新 `last_updated`；完成一项划一项；过期内容移入对应 PLAN/ADR/学习记录（AGENTS.md §13），不留死行。

## 状态速览（2026-10-09）

- main 基线：`ffe807e1`（PR #38 已合入，K1-K6 会话记忆）
- `feature/harness-k7-k12` 已推送 11 commits，**PR #39 待 merge**（https://github.com/qiuqianyi66/tea-ceremony/pull/39）
- 本地 Docker 引擎已修复：启动 `D:\docker\Docker Desktop.exe`（引擎 29.8.2；服务 com.docker.service Stopped 是表象，勿再误判"未安装"）
- 后端全量 `mvn -q test` 本地可跑（含 Testcontainers，需引擎运行）

## A. 阻塞项（需用户操作，2 项）

| # | 事项 | 解锁 |
| --- | --- | --- |
| A3 | 填 `.env` 的 `AI_DASHSCOPE_API_KEY` → `docker compose up -d backend`（新栈 Spring Boot） | P0-1c 向量检索 + K14 LLM mocking |
| A4 | 处理 cu 虚拟桌面占用 | K23 截图打通 + P0-3 前端返工验收 |

## B. 可直接开工（无依赖）

1. **merge PR #39**（CI 13 job 绿后 --admin 合并，同 PR #38 流程；需用户一句确认）
2. **K13 repo map**（tree-sitter，建议与 Phase 3 一起）
3. **P1-2 Orchestrator 复杂度路由**（可先设计，不依赖后端重写）
4. **D 系列低优先**（见下，可穿插）

## C. 依赖卡点（备料可先行，执行要等）

- **P0-1c** 混合检索向量路径（embedding 回填 teawares/etiquettes/relations 三表）→ 等 A3
- **K14** LLM mocking 确定性测试 → 等 A3
- **K15/K16** 结构化日志 + Java 切片 → 等后端重写推进

## D. 低优先（Phase 6 / 工程单遗留）

- K17-K22：Trace→回归、eval 基线 diff、每周 cron 追加、结果度量、HANDOFF 分级、润化包 8 子项
- P1-5 审计员风险标记（⚠ 无来源）、P1-6 ai_usage_logs 消费端、P1-7 前端优化、P1-8 茶园 S1、P1-9 HTTPS、P1-10 OPTIMIZATION 核对
- 技术债：mcp 双版本共存、启动 WARN（随 agent-framework 升级）

## 最近完成（防重做：先查这里，勿从零重写）

- **K1-K6 会话记忆**：PR #38 已合并（ffe807e1）。ChatMemoryService 全套、4 个会话端点、历史锚定≤20 条、降级不丢消息、PRD Spec 门禁、三层语义红线。
- **K7-K12 Phase 2**：PR #39 待 merge，11 commits（af9b314→0e733e7→56cb7d3→71ed5a6→2584885→f9f0c62→4440144→1ba8deb→b9bd8d6→c562252→4b44bf7→f826ee8）。技能准入 O-11、评审闭环≤2 轮、经验链路 patterns 9 条、ADR-014 ArchUnit 两条规则、开工自查、CI job 看门。
- **Docker 引擎修复**（2026-10-09）：Docker Desktop 在 D:\docker（非 C:\Program Files）；引擎未运行 → 启动 exe 即可；5 个 Testcontainers 集成测试本地全绿（29 tests）。

## 关键 ID / 命令（准确取用）

- 分支：`feature/harness-k7-k12`（Phase 2）；main 历史含 `feature/harness-k1-k6`（已合）
- PR：#38 已合（ffe807e1）；#39 待合
- 方案：`docs/plans/PLAN-harness-phase2-2026-10.md`（K7-K12 执行方案）、`PLAN-harness-optimization-2026-10-v2.md`（23 项母本）
- ADR：`docs/ADR/ADR-014.md`（ArchUnit 事务/响应契约）
- 经验池：`docs/plans/patterns.md`（P1-P9 候选，待跨项目验证）

```
npm run quality                     # 提交前门禁（全绿要求）
node scripts/verify-harness.cjs     # 治理一致性，期望 ERRORS: []（ADR 14 / CI 13 job / 技能 .agents 66 + .harness 32）
cd backend && mvn -q test           # 后端全量（含 Testcontainers，需 Docker 引擎）
mvn test -Dtest=LayerDependencyTest # 单跑 ArchUnit（6 条规则）
```

- **ArchUnit 三坑**：① `getAnnotationOfType(Class)` 泛型编译冲突 → 用 `getAnnotationOfType(类型名)`；② `getReturnType().getName()` 含泛型参数 → 用 `getRawReturnType().getName()`；③ `noMethods()...should().exist()` 不存在。
- GitHub push：走 22 端口（443 会被网络重置）；merge main 需 `--admin`（分支保护要求 review）。
