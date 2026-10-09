---
name: handoff-2026-10-09
description: 会话交接总结（2026-10-09）——P0-3 AI key 已启用验证通过；茶园 S1 方案设计完成待确认；S1 实现未开工。供跨会话/新对话恢复上下文。
status: active
owner: yanha
last_updated: 2026-10-09
date: 2026-10-09
---

# HANDOFF · 2026-10-09（会话交接）

## 一句话现状
P0-3 AI key 启用已完结（冒烟通过）；茶园 S1 方案设计已完成、等用户确认 D1-D5；S1 实现未开工。主仓库被另一会话（feature/harness-k7-k12）占用，S1 工作全部在独立 worktree `C:\Users\yanha\Desktop\tea-garden-s1`（feature/garden-s1）。

## 已完成（均验证）
| 块 | 内容 | 证据 |
|---|---|---|
| P0-3 AI key | 百炼工作空间 key（sk-ws-）写入主仓库 .env + application.yml 加 base-url；后端冒烟 code=OK 模型真实回复；提交 `fix(ai)` 219f918（feature/garden-s1） | curl 冒烟通过 |
| 茶园 S1 方案 | 产出 `docs/plans/PLAN-garden-s1-design-2026-10-08.md`（draft，未提交） | 已交付用户 |
| 分支隔离 | worktree 并行，feature/garden-s1 基于 main ffe807e | git worktree |

## 仓库与环境状态
- 主仓库 `C:\Users\yanha\Desktop\tea`：checkout 在 `feature/harness-k7-k12`（另一会话），未提交改动：`M backend/src/test/java/com/tea/architecture/LayerDependencyTest.java`、`?? docs/prd/REQ-job-showcase-requirements-2026-10-08.md` —— 勿碰。
- worktree `C:\Users\yanha\Desktop\tea-garden-s1`：feature/garden-s1 = main ffe807e + 219f918（AI 配置）+ 未提交 PLAN 文档。
- main 与远程同步（ffe807e）。
- 主仓库 `.env`（gitignored）已加：`AI_DASHSCOPE_API_KEY`（sk-ws- 开头，掩码 …eGL0）+ `AI_DASHSCOPE_BASE_URL`（工作空间根地址）。
- 环境注意：Docker Desktop 装在 **D:\docker**（非默认路径，daemon 平时未启动需先起）；本机 5432 被原生 Postgres 占用（冒烟映射 5433）；8080 被另一会话占用（冒烟用 8081）；用户位置：中国/汉中。

## 待办清单
| # | 优先级 | 事项 | 说明 |
|---|---|---|---|
| 1 | 🔴 | 茶园 S1 D1-D5 确认（D1 单事件模型 / D2 规则放 application.yml / D3 契约路径 v1 / D4 阶段阈值 0/100/300/600 / D5 能量只升不降） | 确认后开工 #2~#5 |
| 2 | 🔴 | Flyway V4 + ADR-015（garden_energy_events + garden_plants 扩展列） | 先读 `.harness/skills/biz-dev/09-db-migration` SKILL.md |
| 3 | 🔴 | 后端 garden 域（entity/repo/service/controller/dto/vo，对照 record 域幂等） | 能量记账挂 TastingRecordService.create 同事务 |
| 4 | 🔴 | 前端 GardenView 能量气泡 + 一键收集 + 阶段 3D 映射 | 新增 src/services/api/garden.ts |
| 5 | 🔴 | 契约同步（api-contract.md 移除"⚠ 未实现"标注）+ 验证 + 提交 + 合 main（push 需确认） | mvn test / npm type-check / Flyway 往返 |
| 6 | 🟡 | 每周环境审查 cron（10-12 10:30 触发） | 到时执行 docs/plans/environment-review.md |
| 7 | 👀 | CI Vitest flaky 观察 | 复发则给 perf 阈值留余量 |
| 8 | ⚪ | audit-redlines 扩覆盖 / AGENTS.md 修剪 | 不急 |

## KEY_FACTS
- **AI key 教训**：spring-ai `completionsPath` 默认已含 `/api/v1`（反编译依赖确认），base-url 必须填根地址（`https://ws-rjn1gnbrih5ovoqo.cn-beijing.maas.aliyuncs.com`），否则双拼 404 → 502 降级。配置项 `spring.ai.dashscope.base-url: ${AI_DASHSCOPE_BASE_URL:https://dashscope.aliyuncs.com}`。
- **冒烟链路**：docker 起临时 PG（映射 5433，避开本机 5432）→ `mvn spring-boot:run`（PORT=8081 + 环境变量注入：DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET/AI_DASHSCOPE_*）→ curl `POST /api/v1/ai/chat`。PowerShell `Invoke-RestMethod` 发中文 body 有编码乱码，复测用 curl + body 文件（UTF-8）。
- **S1 数据**：`garden_plants` 最小集已在 V1__init.sql（193-205 行：id/user_id/client_id/plant_type/status('pending')/created_at/updated_at，uk user_id+client_id）；V2/V3 已占编号 → 新表用 **V4__garden_energy.sql**；`garden_energy_events` append-only 账本（PRD §7 DDL 草案），status 语义化 planted/growing/blooming/harvested。
- **契约**：`.harness/wiki/api-contract.md` 90-97 行 garden-plants 段（POST/GET + "⚠ 未实现"标注，实现后移除）；新栈路径统一 `/api/v1/`（前端 http.ts 前缀 /api；records.ts 调 `/v1/records`）。
- **能量触发**：品鉴链路 = 前端本地 IndexedDB → 后台同步 recordsApi.create → 后端 TastingRecordService.create（幂等：findByUserIdAndClientId 查重 + DataIntegrityViolation 兜底）→ 能量记账同事务挂这里，client_id 复用品鉴记录天然防重。
- **后端参考**：`backend/src/main/java/com/tea/record/`（controller/dto/entity/repository/service/vo 六件套）；garden 包不存在需新建。前端 GardenView 纯观赏（plants 恒空，无 API）。
- **worktree 操作**：`git worktree add -b feature/garden-s1 C:\Users\yanha\Desktop\tea-garden-s1 main`；主仓库开工前先 `git status` + `git branch`。

## ARTIFACTS / 关键文件
- `C:\Users\yanha\Desktop\tea-garden-s1\docs\plans\PLAN-garden-s1-design-2026-10-08.md` —— S1 方案（draft，待确认后提交）
- 主仓库 `.env` —— AI_DASHSCOPE_API_KEY / AI_DASHSCOPE_BASE_URL（gitignored）
- `tea-garden-s1\backend\src\main\resources\application.yml` —— base-url 行（已提交 219f918）
- 引用：`docs/prd/garden-product-prd.md`、`.harness/wiki/api-contract.md`、`backend/src/main/resources/db/migration/V1__init.sql`、`src/views/GardenView.vue`、`src/services/api/records.ts`

## 未决问题
1. S1 D1-D5 未确认（新对话第一件事）。
2. feature/garden-s1 与 feature/harness-k7-k12 的合入/推送节奏（K7-K12 另一会话自行处理；garden-s1 完成后合 main 需用户确认再 push）。
3. 冒烟编码问题仅限 PowerShell 测试脚本，真实浏览器链路（fetch UTF-8）无碍。

## 恢复指针（新对话步骤）
1. 问用户 D1-D5 → 2. 改 PLAN 状态 confirmed 并提交 → 3. Read `.harness/skills/biz-dev/09-db-migration/SKILL.md`（Flyway 规范，需重读）→ 4. V4 迁移 + ADR-015 + upgrade/downgrade 往返 → 5. 后端 garden 域 → 6. 前端 GardenView → 7. 契约同步 + 验证 + 提交 → 8. 合 main（push 前确认）。
