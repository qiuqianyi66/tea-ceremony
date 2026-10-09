---
last_updated: 2026-10-09
status: active
owner: yanha
---

# TODO-PRIORITY — 一盏茶 待办与跨会话状态总览（活文档）

> 用途：跨会话状态交接，替代压缩摘要的不确定性。新会话先读本文件，再开工。
> 维护规则：状态变化当场更新 `last_updated`；完成一项划一项；过期内容移入对应 PLAN/ADR/学习记录（AGENTS.md §13），不留死行。

## 状态速览（2026-10-09 晚）

- main 基线：`f763920`（T07 `f5393d2` + T08 `777e900` + T09 `f763920`，均已推送远端）
- **T07-T09 Agent 能力补强全完成**：Trace 四层归因（V5 + ADR-016）、运行时领域技能（V6 + ADR-017）、复杂度三档路由
- **S1 茶园能量账本已合 main**（PR #40，13 job 全绿，3 轮 CI 修复）；V4 迁移 + ADR-015 + garden 域 + 前端收集全部入库
- **A3 compose up backend 完成**：容器 healthy（18080→8080），auth 注册 200 + JWT，AI key 生效 → P0-1c/K14 已解锁
- **最终规划已交付**：`docs/plans/PLAN-final-convergence-2026-10-09.md`（5 阶段 T01-T15）+ 需求 `docs/prd/REQ-quality-backlog-2026-10-09.md` + `docs/prd/REQ-ai-project-2026-10-09.md`
- 本地 Docker 引擎已修复：启动 `D:\docker\Docker Desktop.exe`（引擎 29.8.2）；后端全量 `mvn -q test` 本地可跑

## A. 阻塞项（需用户操作，1 项）

| # | 事项 | 解锁 |
| --- | --- | --- |
| A4 | 处理 cu 虚拟桌面占用 | K23 截图打通 + P0-3 前端返工验收 |

## B. 可直接开工（无依赖）

1. **T10-T13 AI 评测体系**（简历门面重头）：T10 评测集 40-50 条 → T11 eval-tea-ai.cjs（考点加权 + pass^k）→ T12 LLM-as-Judge（qwen-turbo，不挂 CI）→ T13 迭代记录 + 简历 STAR
2. **D 系列低优先**（见下，可穿插）

## C. 依赖卡点（备料可先行，执行要等）

- **T03（A4 cu 桌面）**：等用户处理；T10 评测集不依赖它，可并行开工
- **K14** LLM mocking 确定性测试：A3 已解锁（后端容器在跑）
- **Q1** 真实用户试用（PWA 部署发同学群）：建议 T10-T13 完成后做

## D. 低优先（Phase 6 / 工程单遗留）

- K17-K22：Trace→回归、eval 基线 diff、每周 cron 追加、结果度量、HANDOFF 分级、润化包 8 子项
- P1-5 审计员风险标记（⚠ 无来源）、P1-6 ai_usage_logs 消费端、P1-7 前端优化、P1-8 茶园 S1、P1-9 HTTPS、P1-10 OPTIMIZATION 核对
- 技术债：mcp 双版本共存、启动 WARN（随 agent-framework 升级）；Q2 C6 低优先甄别未做

## 最近完成（防重做：先查这里，勿从零重写）

- **T07-T09 Agent 能力补强**（2026-10-09）：T07 AI 评测 Trace（V5 `ai_eval_traces` 四层 JSONB + TraceRecorder 旁路埋点 + AiChatVo tokens 透传 + ADR-016，容器 PG 往返验证，182 tests）；T08 运行时领域技能（V6 `agent_skills` 4 领域种子 + AgentSkillRouter detect/load + LibrarianAgent 注入 + ADR-017，往返验证，201 tests）；T09 复杂度路由（SIMPLE 直答/MEDIUM 专家/COMPLEX 锚定压缩 20→5，配置化 tea.ai.complexity.*，201 tests）。
- **S1 茶园能量账本合 main**（2026-10-09）：PR #40（feature/garden-s1，8 commits）13 job 全绿 → `--admin --merge`（f600967）。3 轮 CI 修复模式：① Biome 只跑 `npx biome check --write <file>`；② 时间敏感断言用"当天内接近 0"容错；③ vitals 写入等待 5s→30s（本地实测该测试本身 4.8s）。V4 迁移：garden_energy_events + energy 列 + status 归并；ADR-015。
- **A3 compose up backend**（2026-10-09）：8080 被 pid 26916 占用 → 宿主机映射 `18080:8080`（d608c7c）；容器 healthy；`POST /api/v1/auth/register` 200 + JWT；`/actuator/health` UP。
- **T05 漂移修复**（2026-10-09，9d6a1a3）：biz-dev README 03 改两级缓存（ADR-012）；system-overview 全量刷新（Spring Boot 7 域/DashScope/13 job/Docker/garden 能量账本）；CONTEXT 4 处修复；4 个文档元信息头治理。verify-harness 全绿。
- **ADR-015 命名统一**（2026-10-09，f605b88）：ADR-015-garden-energy.md → ADR-015.md（git mv）；AGENTS.md §12 + 工程结构.md ADR 声明 014→015；PLAN-garden-s1-design 引用同步。
- **最终规划交付**（2026-10-09）：REQ-quality-backlog（6 簇 17 项 F-1~F-17 + D-1~D-9）；REQ-ai-project（F-A 评测体系 9 项 / F-B 3 项 / F-C 1 项 + D-A1~A4）；PLAN-final-convergence（T01-T15，V5 迁移/评测器/Judge 模板已写死）。
- **K7-K12 Phase 2**：PR #39 已合并（7975a3f，11 commits）。技能准入 O-11、评审闭环≤2 轮、经验链路 patterns 9 条、ADR-014 ArchUnit 两条规则、开工自查、CI job 看门。

## 关键 ID / 命令（准确取用）

- main：`f763920`（远端已同步）；PR：#38（ffe807e1）、#39（7975a3f）、#40（f600967，S1 已合）
- 分支：feature/garden-s1（已合，worktree `C:\Users\yanha\Desktop\tea-garden-s1` 可删可留）
- 迁移：V1 init / V2 culture_seed / V3 agent_memory / V4 garden_energy / **V5__ai_eval_traces**（T07）/ **V6__agent_skills**（T08）；V5/V6 编号已写死
- 方案：`docs/plans/PLAN-final-convergence-2026-10-09.md`（当前唯一执行母本）；`PLAN-k13-p12-design-2026-10-09.md`（K13/P1-2 设计）
- ADR：`docs/ADR/` 001-017（014 ArchUnit / 015 garden / 016 ai eval trace / 017 agent skills）
- 经验池：`docs/plans/patterns.md`（P1-P9 候选，待跨项目验证）

```
npm run quality                     # 提交前门禁（全绿要求）
node scripts/verify-harness.cjs     # 治理一致性，期望 ERRORS: []（ADR 17 / CI 13 job / 技能 .agents 66 + .harness 33）
node scripts/audit-redlines.cjs     # 红线机械化审计，期望 ERRORS: []
node scripts/audit-wiki-drift.cjs   # wiki 契约漂移审计，期望 ERRORS: []
cd backend && mvn -q test           # 后端全量（201 tests，含 Testcontainers，需 Docker 引擎）
mvn test -Dtest=LayerDependencyTest # 单跑 ArchUnit（6 条规则）
```

- **ArchUnit 三坑**：① `getAnnotationOfType(Class)` 泛型编译冲突 → 用 `getAnnotationOfType(类型名)`；② `getReturnType().getName()` 含泛型参数 → 用 `getRawReturnType().getName()`；③ `noMethods()...should().exist()` 不存在。
- GitHub push：走 22 端口（443 会被网络重置）；merge main 需 `--admin`（分支保护要求 review）。
