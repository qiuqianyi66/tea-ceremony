# p1-1-mcp 变更记录

> 目录：`.harness/changes/p1-1-mcp/`（无数据库迁移，按惯例删除 db-migrations.sql / rollback.sql）
> **无数据库迁移**：本切片不改表结构、不改 Flyway 迁移（MCP 是协议暴露层，数据层零改动）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | p1-1-mcp（culture-search 暴露为标准 MCP 工具，验证"专家=工具 + 协议层解耦"模式） |
| 分支 | 直接提交 main（P1-1 试点切片，继承 P0-1a 五专家） |
| 需求来源 | docs/PLAN-harness-research-2026-10.md P1-1；research-harness-vs-tech-2026-10.md §4（spring-ai MCP 客户端/服务端 + 阿里云百炼 Model Studio 支持 MCP） |
| 类型 | feat |
| 涉及范围 | 后端（pom 依赖 / MCP 工具 / SSE 端点 / Security 放行 / 测试）+ 契约（api-contract） |

## 二、需求与方案

### 需求描述

1. 把现有 `culture-search`（8 表 RAG，P0-1a 五专家共用）暴露为标准 MCP tool，外部 agent（Claude Code/Codex/Goose）可经标准 MCP 协议 HTTP 调用。
2. 验证"专家 = 工具 + 协议层解耦"：专家能力封装为工具，不依赖 LLM key 也能协议调用。
3. 不改专家内部实现（AiChatService 五专家派发承重墙不动）。

### 验收标准（Given-When-Then）

- **Given** backend 启动（含 `spring-ai-starter-mcp-server-webmvc` + `McpToolConfig` 注册 CultureSearchTool）
- **When** MCP client 访问 `GET /mcp`（SSE 握手）
- **Then** 返回 200 `text/event-stream` + `event:endpoint data:/mcp/messages?sessionId=...`（匿名可达，Security 放行）

- **Given** McpSyncServer bean 装配完成
- **When** `mcpServer.listTools()`
- **Then** 工具列表含 `cultureSearch`（description 含"一盏茶"）

- **Given** 有 key 的外部 agent 经 MCP 协议调用 `cultureSearch("龙井")`
- **Then** 返回紧凑 JSON `{"teas":["龙井"],...}`（种子数据可验证）

### 技术方案

1. **选型**：`spring-ai-starter-mcp-server-webmvc:1.1.2`（SSE WebMVC transport），版本对齐 spring-ai 1.1.2（与 alibaba 1.1.2.4-security-fix 的 spring-ai 基础版本一致）。不引入独立 MCP 服务（协议层融入现有 backend，零新基础设施）。
2. **工具**：`CultureSearchTool`（@Component + @Tool cultureSearch(String query)），内部调 CultureSearchService.search（P0-1a 专家同源），输出紧凑 JSON（8 实体 name 列表，空值过滤 + 转义），异常兜底返回 `{"error":"检索失败"}`（协议层健壮性）。
3. **注册**：`McpToolConfig` 提供 `ToolCallbackProvider`（MethodToolCallbackProvider 注册 CultureSearchTool）→ McpServerAutoConfiguration 自动合并为 MCP tools（启动日志 "Registered tools: 1"）。
4. **端点**：`spring.ai.mcp.server.*` 配置 SSE（sse-endpoint=/mcp、sse-message-endpoint=/mcp/messages、type=SYNC、capabilities.tool）。**踩坑**：SSE 属性是 `server` 下连字符键（`sse-endpoint`），不是 `sse:` 子对象（McpServerSseProperties 前缀 `spring.ai.mcp.server`，绑定失败端点 404）。
5. **鉴权**：SecurityConfig 放行 `/mcp` + `/mcp/messages`（与 `/api/v1/culture/**` 同风险等级：只读公开检索；注释声明未来敏感工具必须单独收紧）。
6. **测试**：CultureSearchToolTest（单元 3 测：命中 JSON/空命中/异常兜底）+ McpServerIntegrationTest（集成 3 测：McpSyncServer 装配、listTools 含 cultureSearch、工具直查种子库、/mcp 匿名 200 连接级验证）。**踩坑**：SSE 流连接不结束，HTTP 客户端读 body 必挂起——端点测试用 HttpURLConnection 连接级验证（获取状态码即断开）。
7. **版本冲突记录**：agent-framework 传递 mcp-core 0.14.0，webmvc starter 用 0.17.0（聚合 jar 空壳），Maven 就近调解取 0.14.0；实测 133 测试全绿 + Docker 冒烟 SSE 握手正常，0.14/0.17 兼容此路径。后续切片升级 agent-framework 时统一 mcp 版本。

## 三、影响分析

- 新增公开端点 `/mcp`（SSE）+ `/mcp/messages`（JSON-RPC）：只读公开数据检索，与 culture 同级匿名；未来写/敏感工具必须收紧。
- 新增依赖 `spring-ai-starter-mcp-server-webmvc`（+mcp-spring-webmvc 0.17.0）：pom 单点变更，回滚 = 移除依赖 + 删配置/工具类。
- 契约同步：wiki/api-contract.md 已登记 MCP 端点（🟢 规则）。
- 承重墙确认：AiChatService 五专家派发、teaAI.ts 降级链、ExpertAgent 基类均未改动（MCP 是暴露层，专家内部调用路径不变）。
- 无数据库迁移、无前端改动。

## 四、自检清单

- [x] 十阶段 Gate 逐项满足（需求→方案→实现→测试→冒烟→文档→review→eval→提交）
- [x] 编码规范红线零违反（Controller 层未动；工具类无控制器职责）
- [x] review 通过无 🔴、🟡 清零（review.md 落盘）
- [x] 测试全绿：mvn test 133 tests / 0 fail / 0 error / BUILD SUCCESS
- [x] Docker 冒烟：GET /mcp → 200 + text/event-stream + `event:endpoint data:/mcp/messages?sessionId=...`
- [x] 无数据库迁移（已删两 SQL 并注明）
- [x] eval-harness p1-1-mcp --verify 全绿
