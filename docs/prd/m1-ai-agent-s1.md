---
last_updated: 2026-10-07
status: active
owner: yanha
---

# M5-S1 多智能体：Orchestrator + librarian 专家试点 — 需求分析（PRD 级）

> 阶段 1 产出（需求分析先行规范）。M5 多智能体主线第一片（S1）：Agent 意图路由骨架 + 茶文化学者（librarian）专家试点。
> 事实来源（只读核实）：`PRD-spring-ai-refactor-v2.md §6`（角色/编排/降级设计）、`backend/pom.xml`（agent-framework 依赖已预置 1.1.2.0）、`AiChatController/AiChatService`（T11 透明代理现状）、`CultureSearchService`（RAG 四表检索）、`m1-ai-requirements.md §9`（T11 顺序经验）。日期：2026-10-07。状态：待用户确认。

## 1. 背景与目标

T11 完成透明代理（messages 原样转发，502 降级承重墙保留）。M5 主线目标：AI 从"代理转发"升级为"茶灵多智能体体系"（Orchestrator + 5 专家 + Graph + 记忆）。S1 是主线第一步：验证 Agent 框架装配可行性 + 跑通"专家路由"最小闭环（librarian 问答带 RAG 出处），为 S2（5 专家）+ S3（Graph）铺路。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F-S1-1~5） | ① agent-framework 版本与 dashscope 统一（消除 1.1.2.0/1.1.2.4 混用风险）；② `AgentOrchestrator` 意图路由骨架（显式 agent 参数优先 + 关键词意图粗分）；③ librarian 专家：复用 CultureSearchService RAG + 专家 prompt；④ `/api/v1/ai/chat` 支持 `agent=librarian`（其余回落透明代理）；⑤ 契约登记 + 测试 |
| 不做 | 5 专家齐（S2）；agent_prompts 版本化（S2）；会话记忆表（S2）；Graph 工作流（S3）；SSE 流式（S4）；前端 agent 参数适配（S4，S1 后端先行） |

## 3. 现状事实（已核实）

- pom.xml：`spring-ai-alibaba-agent-framework` 已预置（version=${spring-ai-alibaba.version}=1.1.2.0）；dashscope starter=1.1.2.4-security-fix。**混用风险**：框架与模型 starter 版本不一致可能运行时冲突。
- 社区验证组合（掘金 2026-05）：SAA 1.1.2.2 + Spring AI 1.1.2 + Boot 3.5 是实战验证的 5 种多 Agent 编排组合。
- T11 现状：AiChatService 透明代理（key 缺失→502；成功→落计量）；CultureSearchService 四表 ILIKE RAG。
- 前端 teaAI.ts：`askTeaMaster` 无 agent 参数（S4 加）；AiChatRequest 已有可选 `agent` 字段（T11 已定义）。

## 4. 功能需求（Given-When-Then）

### F-S1-1 版本统一

- Given pom 中 agent-framework=1.1.2.0、dashscope=1.1.2.4-security-fix，When 构建，Then 两依赖版本统一为 `1.1.2.4-security-fix`（若阿里云 Maven 该版本存在；否则退 1.1.2.2 社区验证组合），`mvn -q dependency:tree` 无版本冲突。
- Given 无 key 启动，Then 应用正常启动（agent-framework 装配不强制 key，与 T11 一致显式 502 降级）。

### F-S1-2 Orchestrator 路由骨架

- Given 请求带 `agent=librarian`，Then 路由到 librarian 专家（不走透明代理）。
- Given 请求无 agent 且含知识/文化关键词（茶/茶器/历史/冲泡 之知识意图），Then 关键词意图粗分命中 librarian。
- Given 意图无法判定，Then 回落透明代理（现有行为不变）。
- Given 未知 agent 值，Then 400 `PARAM_INVALID`（AiChatRequest 校验扩展枚举）。

### F-S1-3 librarian 专家（RAG 带出处）

- Given 用户提问，Then 专家流程 = 意图解析 → CultureSearchService RAG 检索 → 专家 system prompt（含检索上下文）→ LLM 生成 → 回复带"知识来源"（命中茶/诗清单，前端 S4 渲染引用卡片）。
- Given LLM 不可用，Then 走现有 502 降级链（承重墙不变）。
- Given RAG 检索为空，Then 专家用通用茶文化知识回答（不编造，明确"知识库未命中"）。

### F-S1-4 兼容与回归

- Given 无 agent 的既有调用，Then 行为与 T11 完全一致（透明代理 + 计量 + 502 降级）。
- Given 计量，Then librarian 调用同样落 ai_usage_logs（agent=librarian）。

### F-S1-5 契约与测试

- Given 实现完成，Then api-contract 登记 `agent` 枚举（chat/advisor/taster/librarian/brewer/mentor，S1 仅 librarian 生效）；Orchestrator 路由单测 + librarian 集成测试（mock ChatClient）+ 透明代理回归测试全绿。

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 承重墙 | teaAI.ts 降级链零改动；502 语义不变；透明代理回落完整保留 |
| 版本 | agent-framework 与 dashscope 版本统一；禁引入未验证版本 |
| 依赖 | 复用现有 CultureSearchService/计量；不新增表（会话/记忆 S2） |
| 验证 | `mvn -q test`（新路由/专家/回归）+ 无 key 启动冒烟 + 有 key 冒烟（用户 key 或 mock） |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 后端 | 新增 `ai/agent` 包（Orchestrator/librarian）；AiChatService 扩展路由；pom 版本统一 |
| 前端 | 零改动（S1 后端先行；agent 参数前端 S4 传） |
| 契约 | agent 枚举登记；未知 agent 400 |
| 风险 | agent-framework 装配兼容性（S1-1 版本统一先行验证）；意图误判回落透明代理（兜底安全） |

## 7. 验收清单（阶段 1 自检）

- [x] F-S1-1~5 编号 + Given-When-Then
- [x] 事实只读核实（pom 版本/社区组合/T11 现状/AiChatRequest agent 字段）
- [x] 承重墙声明（透明代理回落 + 502 不变 + 前端零改动）
- [x] 不做项明确（S2/S3/S4 内容后置）
- [x] 版本风险前置（F-S1-1 第一步验证）
