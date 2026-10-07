# p1-1-mcp Review

> 评审对象：P1-1 MCP 工具化试点（culture-search → 标准 MCP tool + SSE 端点）
> 评审方式：逐项核对（需求→选型→实现→测试→冒烟→契约→风险）
> 结论：**通过**，0 🔴 0 🟡（详见尾部 verdict）

## 一、逐项评审

### 1. 需求对齐（vs 工程单 P1-1 + 用户"专家=工具/协议层解耦"）

- ✅ culture-search 暴露为标准 MCP 工具：`CultureSearchTool.@Tool cultureSearch(query)`，McpSyncServer.listTools 验证注册
- ✅ 外部 agent 可接入：SSE WebMVC transport（/mcp），Docker 冒烟 `event:endpoint data:/mcp/messages?sessionId=` 协议握手真实成立
- ✅ 承重墙零改动：AiChatService/ExpertAgent/teaAI.ts 未动；MCP 是暴露层
- ✅ 不造轮子：用 spring-ai 官方 starter + MCP SDK，未手写协议

### 2. 选型核查

- ✅ `spring-ai-starter-mcp-server-webmvc:1.1.2` 可拉取、依赖树确认（webmvc autoconfigure + mcp-spring-webmvc 0.17.0）
- ✅ 版本对齐：spring-ai 1.1.2 == alibaba 1.1.2.4-security-fix 的 spring-ai 基础版本
- ✅ 属性/端点从 jar 反查（McpServerSseProperties.CONFIG_PREFIX=spring.ai.mcp.server），未凭教程猜
- ⚠️ 已知技术债（记录不阻塞）：mcp-core 0.14.0（agent-framework 传递）与 0.17.0（starter 族）双版本共存，就近调解取 0.14.0；实测 133 测试全绿 + 冒烟正常，兼容此路径。**后续升级 agent-framework 时统一 mcp 版本**。

### 3. 实现核对（源码级）

- ✅ CultureSearchTool：入参 query、8 实体紧凑 JSON、空值过滤 + 引号转义、异常兜底 `{"error":"检索失败"}`；访问器与 CultureSearchResult record（teas/people/regions/poems/teawares/etiquettes/relations/processes + PoemItem.title/RelationItem.source-target/TeawareItem.name/EtiquetteItem.name）逐一实读匹配
- ✅ McpToolConfig：MethodToolCallbackProvider 注册 CultureSearchTool（官方推荐路径）
- ✅ application.yml：name/version/type=SYNC/capabilities.tool/sse-endpoint/sse-message-endpoint（连字符键，实测生效）
- ✅ SecurityConfig：/mcp + /mcp/messages 放行 + 敏感工具收紧注释

### 4. 测试证据

- ✅ mvn test 全量：**133 tests / 0 fail / 0 error / BUILD SUCCESS**（127 基线无回归 + 新增 6）
- ✅ CultureSearchToolTest（3）：命中紧凑 JSON / 空命中空数组 / 异常兜底
- ✅ McpServerIntegrationTest（3）：McpSyncServer bean 装配 / listTools 含 cultureSearch(description 含"一盏茶") / 工具直查种子库含"龙井" / /mcp 匿名 200（连接级）
- ✅ Docker 冒烟：GET /mcp → HTTP 200 + Content-Type: text/event-stream + `event:endpoint data:/mcp/messages?sessionId=46745806-...`

### 5. 契约与文档

- ✅ api-contract.md 登记 MCP 端点（🟢 规则：方法/路径/传输/工具/鉴权/接入方式）
- ✅ changes/p1-1-mcp/summary.md 落盘（无迁移注明）
- ✅ 工程单 PLAN P1-1 状态待同步（提交时一并更新）

### 6. 风险与边界

- ✅ 端点匿名：只读公开检索，与 /api/v1/culture/** 同等级（SecurityConfig 注释明示未来收紧）
- ✅ SSE 测试防挂起：连接级验证（读 body 必 hang，已踩坑记录在 summary）
- ⚠️ 残留：`SyncMcpToolProvider: No tool methods found in the provided tool objects: []` 启动 WARN——来自 spring-ai-alibaba 空 ToolCallbackProvider 注册，无害（随后 "Registered tools: 1" 覆盖）；升级 agent-framework 时核对

## 二、迭代记录（多轮 review 收敛）

1. **R1**：@Tool 直接依赖 spring-ai-starter-mcp-server（stdio）→ 发现 1.1.2 无 servlet auto-config → 换 webmvc starter（查 Maven Central 验证存在性）
2. **R2**：listTools 为空（缺 ToolCallbackProvider）→ 补 McpToolConfig 注册（查 ToolCallbackConverterAutoConfiguration 参数签名确认链路）
3. **R3**：/mcp 404 → 条件报告 matched 但端点不达 → 查 McpServerSseProperties.CONFIG_PREFIX → 修正 yml 连字符键 → 200
4. **R4**：/mcp 401（Docker）→ SecurityConfig 放行 → 修正
5. **R5**：SSE 测试挂起（RestTemplate 读流）→ 改连接级验证 → 全量 133 绿
6. **R6**：清理临时诊断文件、api-contract/changes 落盘

## verdict

🔴 0 🟡 0 —— 通过。P1-1 满足验收：MCP 端点协议握手真实成立、工具注册有测试与日志双证据、承重墙零改动、契约已登记。技术债 2 项（mcp 双版本、启动 WARN）记录在 summary 风险节，随 agent-framework 升级一并处理。
