# p0-1a-agents 变更记录

> 目录：`.harness/changes/p0-1a-agents/`（本次在 main 直接落库）。
> 依据：`docs/prd/ai-agents-prd.md`（F-1~F-7，用户已确认：mentor 用品鉴记录+常识；专家人设差异化语气）。
> **无数据库迁移**（纯代码 L2 切片）——按模板惯例删除 db-migrations.sql / rollback.sql。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | p0-1a-agents：M5 五专家注册（advisor/taster/brewer/mentor） |
| 需求来源 | `docs/prd/ai-agents-prd.md`（F-1~F-7） |
| 类型 | feat（后端专家扩容） |
| 涉及范围 | 后端 ai 域（4 新 Agent 类 + Orchestrator 路由泛化 + AiChatService 派发 + 测试）；契约文档 api-contract |

## 二、需求与方案

### 需求描述

1. F-1 advisor 荐茶师：teas/regions/processes 检索 + 荐茶 prompt（推荐茶单形态）。
2. F-2 taster 品鉴师：用户最近品鉴记录 + 口感分析 prompt（品鉴点评形态）。
3. F-3 brewer 冲泡师：processes/teawares 检索 + 冲泡参数 prompt（冲泡方案形态）。
4. F-4 mentor 成长导师：品鉴记录 + 茶文化常识 + 成长引导 prompt（成长建议形态；XP 后置 P1-8）。
5. F-5 Orchestrator 路由泛化：显式 6 枚举 → 对应专家；未知 400；无 agent 文化意图 → librarian。
6. F-6 专家通用契约：prompt 内置常量 / sources / key 缺失 502 / 计量旁路。
7. F-7 测试：每专家 + 派发矩阵 + 路由矩阵。

### 验收标准（Given-When-Then）

- **Given** 请求带 `agent=advisor|taster|brewer|mentor` **When** 调用 /api/v1/ai/chat **Then** 路由到对应专家（非透明代理），无 key 时 502 降级。
- **Given** 请求带 `agent=robot` **When** 调用 **Then** 400 PARAM_INVALID。
- **Given** 无 agent 且含"茶"类关键词 **When** 调用 **Then** 路由 librarian（回归不变）。
- **Given** `mvn -q test` **When** 执行 **Then** 126 测试全绿（新增 30）。

### 技术方案

- 4 新 Agent 类复用 LibrarianAgent 模式（key 检查 → 检索 → 专家 prompt → LLM → sources → 计量）；prompt 人设差异化（用户点名）：advisor 温婉荐茶、taster 品鉴笔记、brewer 实操参数、mentor 温和引路。
- AgentOrchestrator 新增 `routeToAgent`（返回 AgentType；null=透明代理）；`routeToLibrarian` 保留委托（S1 契约兼容）。
- AiChatService 五专家派发；null/CHAT 回落透明代理（T11 行为不变）。
- 红线冲突清零：未知 agent 400 收紧保持；承重墙（502 降级链/计量旁路）未触。

## 三、影响分析

- AiChatService / AgentOrchestrator 扩展；AiChatController 无改动（agent 参数已支持）。
- ai_usage_logs.agent 字段记对应枚举（表已支持）。
- 前端无破坏性变更（teaAI.ts 降级链保留）。
- 契约更新：`.harness/wiki/api-contract.md`（S1→S2 全量生效说明）。
- 承重墙确认：502 降级链 / 计量旁路未触及；无 DB 迁移。

## 四、自检清单

- [x] 需求文档先行且用户确认（docs/prd/ai-agents-prd.md，两问已答）
- [x] 编码规范红线零违反；无孤儿代码（MentorAgent renderContext 已接线）
- [x] review 落盘 review.md（评审记录）
- [x] 测试全绿：mvn test 126（+30）
- [x] 冒烟通过：五专家 502 降级、未知 agent 400（本地 docker 后端）
- [x] 无数据库迁移（顶部已注明）
- [x] eval-harness 七维评测通过
