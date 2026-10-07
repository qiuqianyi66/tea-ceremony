---
last_updated: 2026-10-07
status: active
owner: yanha
---

# Harness 资料 × 当前技术比对（2026-10-07）

> 目的：把 278/285/最新动向从"蓝图"落到"现在到底用什么、怎么用"——与当前主流工具、协议、以及一盏茶实际技术栈逐项比对。结论见文末。

## 1. 主流 Coding Agent 工具比对（2026-10 版，比 285 工具表更新）

| 工具 | 形态 | 许可 | 强项 | 短板 |
|---|---|---|---|---|
| Claude Code | CLI+IDE+桌面+云 | 闭源（CLI 免费） | 最全表面：hooks/定时例程/MCP/skills/subagents；计划模式+权限提示 | 绑定 Anthropic 模型 |
| Codex CLI | CLI | **Apache 2.0 开源** | 登顶 Terminal-Bench（GPT-5.5）；沙箱终端；继承 ChatGPT 治理 | 绑定 OpenAI 模型 |
| Cline | VS Code 插件 | Apache 2.0 | Plan/Act 模式，**每次行动前确认**（人留在回路） | 需 IDE |
| Aider | CLI | Apache 2.0 | **git-native**：每次编辑即 commit | 无 Plan 模式 |
| OpenHands | 平台 | MIT | 团队级部署+沙箱隔离 | 重 |
| Goose | CLI | Apache 2.0 | 最深 MCP 集成（70+ 扩展，可当 MCP server）；YAML Recipes 规模化 | 较新 |
| Pi | CLI | MIT | 极简：4 工具、sub-1K token 系统提示（印证工具最小化） | 小众 |
| OpenCode / Kilo Code | CLI/IDE | 开源 | 全模型选择 / 多 IDE 一屋顶 | 生态较新 |

**选型建议（开发者工具层）**：① 追求最全 harness 能力 → Claude Code（hooks+计划模式与我们 Change Protocol 最贴合）；② 开源+基准分 → Codex CLI；③ 人控严格 → Cline。一盏茶当前用豆包 agent 会话 + 仓库自建 harness（AGENTS.md/三规则/CI），与上述 CLI 工具**互补而非替代**——它们是"在仓库跑 agent"的执行器，我们是"约束 agent"的规则层。

## 2. 协议层比对（概念澄清）

| 协议/标准 | 层 | 作用 | 治理 |
|---|---|---|---|
| **MCP** | 线协议（wire protocol） | agent ↔ 工具（JSON-RPC 2.0，tools/resources/prompts） | Linux Foundation Agentic AI Foundation（2025-12 起） |
| **A2A** | 线协议 | agent ↔ agent（Google 2025-04） | 同上 |
| **AGENTS.md** | 内容标准 | 仓库→agent 的常驻上下文 | 同上（2025-12 纳入） |
| **Harness** | **runtime（执行层）** | 说/不听 MCP、多协议并存；持有 loop/state/tools/permissions/recovery | 非标准，是工程实践 |

要点：**MCP 与 harness 不在同一层，不能二选一**（FutureAGI/MarkTechPost 共识）。MCP tools 在 ReAct loop 的 Action 步运作；harness 决定 loop/权限/恢复。datallmlab 已把每个 harness 组件映射到 MCP 表面（spec 2025-11-25 当前版）。

## 3. 技术栈逐项映射：蓝图 → 一盏茶现有技术（本次查证）

| Harness 蓝图组件 | 一盏茶现有技术 | 状态 |
|---|---|---|
| 上下文（AGENTS.md 地图+docs 记录系统） | AGENTS.md + .harness/rules 三件套 + docs/ADR×13 + .harness/wiki 四件套 | ✅ 同构 |
| 架构约束机械化 | biome+type-check+CI 13 job（前端）；编码规范.md（后端文档） | △ 后端无 ArchUnit 测试（P1） |
| 反馈循环 | review.md + .claude/agents 三子代理 + eval-harness 七维评测 | ✅ |
| 熵管理 | 治理同步纪律 + 经验三级进化 | △ doc-gardening 脚本化（P2） |
| 持久化记忆 | HANDOFF + .harness/changes 三件套 + ai_chat_sessions 表（已建） | ✅ |
| **工具接入层（MCP）** | **Spring AI Alibaba 原生支持**：`spring-ai-starter-mcp-client`（同步/异步、stdio/http/SSE 传输）+ `spring-ai-alibaba-agent-framework`（Agent 运行）+ `defaultTools(toolCallbackProvider)` 自动注册 | **✅ 可落地（本次查证）** |
| 模型路由（复杂度→模型） | M5 AgentOrchestrator 路由（显式 agent/文化域/回落） | △ 加复杂度分级（P1） |
| 动态派生（按任务雇专家） | M5 固定 5 专家（librarian 已注册） | △ 远期（P3） |
| 结构化纠错三要素 | caveman-review 格式（L:🔴问题.修复.） | △ 补"根因（为什么）"+附失败输出（P1） |

## 4. MCP 落地路径（结合现有栈，本次核心发现）

```
一盏茶 M5（Spring Boot 3.5 + Spring AI Alibaba）
│
├─ MCP Server（可新建 spring-ai-alibaba MCP 模块）
│    ├─ culture-search 工具（8 表 RAG 检索 → 暴露为 MCP tool）
│    ├─ brew-params 工具（冲泡参数，tea-tasting 基准表）
│    └─ tasting-query 工具（品鉴记录统计）
│
└─ ChatClient（spring-ai-starter-mcp-client）
     └─ defaultTools(toolCallbackProvider) 自动注册 → 主 LLM 直接调用
```
- 依据：Spring AI Alibaba 官方文档（java2ai.com MCP 教程，2026-08 更新）——MCP 客户端启动器提供多客户端管理/自动初始化/多命名传输；Nacos 集群发现（LoadbalancedMcpClient）企业级可选。
- 收益：专家能力与主 LLM 解耦为标准工具协议；未来任何支持 MCP 的外部 agent（Claude Code/Codex/Goose）可直接复用我们的工具，不绑死 Orchestrator 内部实现。
- 阿里云百炼 Model Studio 也已支持 MCP（Responses API tools 参数）——与现有 DashScope key 生态一致。

## 5. 结论与 P1 落地清单

**总体结论**：语雀/一手资料的核心不落后；真正"现在的技术"增量 = ①工具层（Claude Code/Codex 双雄 + 极简派）②协议层（MCP 标准化的工具接入）③平台原生化（Agents API 托管）。一盏茶在规则层（AGENTS.md/约束/反馈/评测）已同构，**最大技术结合点是 MCP**——Spring AI Alibaba 已支持，是下一步最实的落地。

1. **P1a 后端 ArchUnit 分层测试**：编码规范.md 分层规则机械化（Controller→Service→Repository 单向 + 构造器注入 + 禁 Controller 查库）。
2. **P1b MCP 工具化试点**：新建 Spring AI Alibaba MCP server 模块，把 culture-search（8 表 RAG）暴露为 MCP tool，主 ChatClient 自动注册——验证"专家=工具"模式。
3. **P1c Orchestrator 复杂度路由**：query 复杂度分级 → 廉价路径（文化域/回落）vs 深度路径（专家+慢模型）。
4. **P1d review 结构化纠错**：finding 补"根因（为什么）"并附失败测试/编译错误原文。
5. **P2 doc-gardening**：eval-harness 加"文档一致性"维 + CI 定时。

> 底座：本文 + research-harness-latest-2026-10.md（最新进展）+ research-harness-engineering-285-2026-10.md（总纲）+ research-harness-alibaba-2026-10.md + research-multiagent-278-2026-10.md。
