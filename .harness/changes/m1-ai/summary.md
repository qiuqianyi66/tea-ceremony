# m1-ai 变更记录

> 目录：`.harness/changes/m1-ai/`，与 git 分支 `feature/m1-ai` 同名。
> 本变更**无数据库迁移**（ai_usage_logs 表 V1 已建；RAG 查现有 4 表），按模板省略 db-migrations.sql / rollback.sql。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-ai（T11 AI 切片，批 C 第二片） |
| 分支 | `feature/m1-ai`（基于 main 5de1b90） |
| 需求来源 | `docs/prd/m1-ai-requirements.md`（F11-1~5，D11-1~5） |
| 类型 | feat |
| 涉及范围 | 后端（新增 ai 域 + culture 域 search）+ pom（starter-dashscope）+ 前端（teaAI.ts 切 v1） |

## 二、需求与方案

### 需求描述

1. LLM 透明代理：`POST /api/v1/ai/chat`，messages 原样转发 DashScope，返回 content。
2. RAG 检索：`GET /api/v1/culture/search`，跨 4 表 ILIKE，各 ≤5。
3. 计量：仅成功调用落 ai_usage_logs（agent/model/tokens/latency；游客 user_id 空）。
4. 前端 teaAI.ts 切 v1 路径 + ApiResponse 解包；降级逻辑零改动。

### 验收标准（Given-When-Then）

- **Given** 配置有效 key
- **When** POST /api/v1/ai/chat
- **Then** 200 + `data.content`，ai_usage_logs 落一条（tokens/latency）

- **Given** 无 key / 占位 disabled / 上游失败
- **When** POST /api/v1/ai/chat
- **Then** 502 BAD_GATEWAY（前端 teaAI 降级规则引擎，不写计量）

- **Given** 游客无 token
- **When** GET /api/v1/culture/search?q=龙井
- **Then** 200 + data.teas 命中种子（西湖龙井）；q 空返回四空数组

### 技术方案

- ai 域：controller/service/repository/entity/dto/vo，构造器注入 ChatClient.Builder；`spring-ai-alibaba-starter-dashscope:1.1.2.4-security-fix`。
- culture 域：JdbcTemplate 只读 ILIKE（参数化防注入），不建多余实体；5 个 vo。
- common：ErrorCode 加 BAD_GATEWAY，新增 BadGatewayException。
- 安全：SecurityConfig 放行 `/api/v1/ai/**`、`/api/v1/culture/**`。
- 配置：`AI_DASHSCOPE_API_KEY`；application.yml 占位 `${AI_DASHSCOPE_API_KEY:disabled}`——无 key 启动成功，Service 显式 502。
- 前端：callLLM / fetchRAGContext / askTeaMaster 三处路径 + 解包；降级承重墙回归测试锁定。

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | 无库变更（复用 V1 ai_usage_logs + 4 张 culture 表） |
| API | 新增 POST /api/v1/ai/chat、GET /api/v1/culture/search（已同步 api-contract） |
| 前端 | teaAI.ts 切 v1（3 处路径/解包）；降级逻辑不变 |
| 承重墙 | 浏览器不直连 AI（走后端代理）；降级规则引擎保留并回归 |
| 回滚 | git 回退；前端路径恢复旧栈即回退（降级路径仍通） |

## 四、质量门禁（自检）

- [x] 编码规范红线零违反（分层单向 / 统一 ApiResponse / 构造器注入）
- [x] 后端编译 0 error（`mvn -q compile`）
- [x] 后端测试：82/82 全绿（新增 AiChatControllerTest 4 + CultureSearchIntegrationTest 4）
- [x] 前端 quality：8 个 teaAI 测试全绿 + type-check + build + verify:static
- [x] 无迁移（V1 已建表，零迁移声明）
- [x] expert-reviewer 评审：🔴 零、🟡 清零（见 review.md）
