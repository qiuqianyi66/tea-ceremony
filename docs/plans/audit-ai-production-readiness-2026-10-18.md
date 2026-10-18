---
last_updated: 2026-10-18
status: active
owner: yanha
---

# AI Agent 生产级成熟度审计（2026-10-18）

> 审计基准：企业级「生产级系统设计四根支柱」+ 8 张专题图（高容错 / 多级兜底 / 复杂闭环 / Human-in-the-Loop / ReAct / Tool Calling / 拦截-重试-兜底 / 多 Agent 与上下文压缩 / 三大黄金指标 / 运行时兜底 / LLM-as-a-Judge / 灰度与无损回滚 / 分布式追踪）。
> 审计方法：逐条读代码取证，不接受「文档写了」当实现。所有判定附 `文件:行号`。
> 范围：`backend/src/main/java/com/tea/ai/**`（30 个类）+ 相关配置与前端降级链。

## 一、总评

| 支柱 | 得分 | 判定 |
|---|---|---|
| 业务拆解与流程设计 | 8.5 / 10 | 强：五专家路由 + 三档复杂度 + 上下文压缩 + 会话记忆锚定 |
| 高可用工具链与架构设计 | 6.5 / 10 | 中：有熔断/配额/限流，但熔断是**全局单例**，无超时 |
| 工程化交付与持续迭代 | 8.0 / 10 | 强：CI 13 job、LLM-as-a-Judge 脚本、回滚脚本 |
| 系统评估体系与稳定性兜底 | 4.0 / 10 | **弱：有原始数据，无三大黄金指标报表；后端无本地规则兜底** |

**核心结论：这是一套「路由做得比容错好」的 Agent 系统。** 拆解能力已到企业级，但执行链路的容错只做到了「拦截」一层，重试、超时、分链路熔断、本地兜底、量化报表全部缺失。用截图的说法：**「没有可观测性与异常兜底的 Agent 系统，在线上运行就如同悬挂在半空的定时炸弹」**——而当前状态正是缺了兜底与量化这两半。

## 二、逐条对照（20 项）

### 支柱一：业务拆解与流程设计

| # | 标准 | 判定 | 证据 |
|---|---|---|---|
| 1 | 多 Agent Router/Supervisor | ✅ 达标 | `AgentOrchestrator.routeToAgent()`：显式 agent → 枚举校验（未知 400）；隐式 → 文化关键词路由 librarian；其余回落透明代理 |
| 2 | 复杂度分层 | ✅ 达标 | `AgentOrchestrator.complexity()` 三档：SIMPLE ≤40 字且 ≤3 轮、COMPLEX >200 字或 >3 轮，阈值全配置化 |
| 3 | 上下文压缩 | ✅ 达标 | `AiChatService.anchor()` L150：COMPLEX 只取最后 5 条历史，MEDIUM/SIMPLE 取 20 条 |
| 4 | 复杂业务闭环 | ✅ 达标 | 前端 22 路由 + 后端 8 业务包（ai/auth/common/culture/garden/record/tea/ware），闭环完整 |
| 5 | 模糊需求指标化 | 🟡 部分 | 复杂度按「字数/轮次」指标化，但**没有把「用户满意度/任务完成」指标化**，无法回答「这次回答好不好」 |

### 支柱二：高可用工具链与架构设计

| # | 标准 | 判定 | 证据 |
|---|---|---|---|
| 6 | 接口熔断（按链路隔离） | ❌ **缺口** | `AiCircuitBreaker` L23-25：`AtomicInteger consecutiveFailures` + `volatile long openedAt` 各只有**一份**。5 个专家 + 透明代理共享同一个熔断状态 → librarian 连续失败 5 次，会把 chat/advisor/taster/brewer/mentor 一起熔断 |
| 7 | 超时控制 | ❌ **缺口** | `BaseExpertAgent:70` `.call().chatResponse()`、`AiChatService:259` 同样——**无 read timeout**。上游挂起时 Tomcat 线程被占满，P99 不可控 |
| 8 | 高并发低延迟 | ❌ **缺口** | 未使用虚拟线程；无并发隔离（舱壁）；慢链路会拖垮整个线程池 |
| 9 | 高精度 Tool Calling | ❌ **缺口** | `McpToolConfig:16-18` 只把 `CultureSearchTool` 注册成 `ToolCallbackProvider` 给 **MCP 外部客户端**用；`LibrarianAgent:68` 走的是 `cultureSearchService.search(question)` **直接方法调用**，不是 tool calling。即：chat 路径上没有工具调用的参数约束与行为对齐 |
| 10 | ReAct（Think-Act-Observe-策略调整） | ❌ **缺口** | 全部链路是单次 `prompt().call()`，无循环、无观察回填、无策略调整 |

### 支柱三：工程化交付与持续迭代

| # | 标准 | 判定 | 证据 |
|---|---|---|---|
| 11 | LLM-as-a-Judge CI | ✅ 达标 | `scripts/eval-*.cjs` 7 个 + `eval-harness.cjs` 七维评测门禁；`ai_eval_traces` 四层归因底座（ADR-016） |
| 12 | 无损回滚 | 🟡 部分 | `scripts/rollback.ps1` 已具备镜像快照 + 健康门禁（2026-10-17 补），但**回滚粒度是容器级（分钟级）**，不是截图的「毫秒级无损回滚」 |
| 13 | 灰度发布 / 双轨流量 | ❌ **缺口** | 无 A/B 分流、无实验组标记、无「异常指标触发器自动回退」 |
| 14 | 分布式追踪 Trace ID | 🟡 部分 | `X-Request-Id`（nginx 生成）+ `ai_eval_traces.request_id`（UUID）已有；但**agent 内部的子调用（专家 LLM 调用 / RAG 检索）不生成 span**，无法还原「Router → Sub-Agent → API」路径 |
| 15 | 旁路失败可观测 | ✅ 亮点 | `TraceRecorder.record()` L99-103：落库失败 `log.warn` + `meterRegistry.counter("tea.ai.trace.save.failed")`。这条是 PR #43 的真实教训沉淀（历史上 librarian 的 trace 曾静默丢失） |

### 支柱四：系统评估体系与稳定性兜底

| # | 标准 | 判定 | 证据 |
|---|---|---|---|
| 16 | 拦截 Intercept | 🟡 部分 | 有统一语义：`BadGatewayException`(502) → 前端 `teaAI.ts` 降级。但只拦不处理 |
| 17 | 重试 Retry（指数退避） | ❌ **缺口** | `BaseExpertAgent:71` 与 `AiChatService:260`：`catch (Exception e) → throw new BadGatewayException(...)`，**一次失败即放弃** |
| 18 | 兜底 Downgrade（本地规则库） | ❌ **缺口** | 后端零规则库。唯一兜底在前端 `src/services/teaAI.ts`——意味着**后端一旦不可达，规则引擎也跟着跑不了**（前端也拿不到后端数据） |
| 19 | 防死锁 / 执行深度检测 | ❌ **缺口** | 无深度计数、无递归保护、无「强制打断错误路径上的无限推理」 |
| 20 | 三大黄金指标（成功率 / 工具异常率 / P99） | ❌ **缺口** | 有原始表：`ai_usage_logs`（tokens/latency）、`ai_eval_traces`（error_code/latency_ms/agent_type）；**无任何聚合查询与端点**。`ai` 包下 Controller 只有 chat 与 session 两类 |

## 三、缺口归因

三个根因，不是二十个独立问题：

1. **执行链路缺骨架**（#17/#18/#19/#6/#7）。当初实现是「能调通就行」：一次调用 + 一个全局 try/catch + 一个全局熔断器。企业级需要的是 `拦截 → 重试(退避) → 分级熔断 → 深度门禁 → 本地兜底` 五段链路，且每段有独立指标。
2. **评估缺出口**（#20/#5）。数据采了但没人看：`ai_usage_logs` 与 `ai_eval_traces` 只服务于离线脚本 `eval-*.cjs`，线上没有实时报表。等于「有仪表盘传感器，没接仪表盘」。
3. **演进机制缺一层**（#13/#14）。能发版、能回滚，但没有灰度；能追踪到请求，但追不进 Agent 内部。

## 四、本轮返工范围（已开工）

| 项 | 对应缺口 | 交付物 |
|---|---|---|
| 容错执行器 `AiCallExecutor` | #17 #19 #6 #7 #8 | 硬超时（虚拟线程）+ 指数退避重试（带抖动）+ 分级熔断 + 深度门禁 + 统一 502 语义 |
| 熔断分桶 | #6 | `AiCircuitBreaker` 按 lane 隔离，保留旧无参 API 兼容现有测试 |
| 本地规则兜底 | #18 | `AiLocalRuleEngine`（水温/时间/投茶/茶类介绍 5 类规则，数据来自 `teas` 表）+ `LocalFallbackService` |
| 三大黄金指标 | #20 | `GoldenMetricsService`（Task Success Rate / Error Rate / P50-P95-P99）+ `GET /api/v1/ai/metrics/golden` |

## 五、未覆盖（下一轮，已定性）

| 项 | 为什么不在本轮 | 预估 |
|---|---|---|
| #13 灰度双轨 + 毫秒级回退 | 需要网关层流量镜像与版本标记，属基础设施改造；且当前单实例部署无「双轨」物理条件 | L3，需 ADR |
| #14 Agent 内部 span | 需要 OpenTelemetry 或自建 span 表；本轮先把 lane 维度拆出来，span 需单独设计 | L3 |
| #9 Tool Calling 进 chat 路径 | 把 `LibrarianAgent` 的直接检索改造成 tool calling 会改变回答质量基线，需先有 A/B 能力（依赖 #13） | L2，需回归基线 |
| #10 ReAct 循环 | 同上，且会显著提高 token 成本；需先用 #20 的指标建立成本基线 | L2 |
| #5 回答质量指标化 | 需人工标注集 + Judge 线上化（当前 Judge 只在 CI 离线跑） | L2 |

## 六、审计方法学备注

- 所有 `❌` 均有 `文件:行号` 证据，可复核。
- 未采信 `CHANGELOG.md` / `docs/` 里的「已完成」声明作为实现证据（AGENTS.md §0.6：结论以实测为准）。
- 未评估 `docs/skills/` 与 `.agents/skills/` 的治理质量——那是 harness 层，与 Agent 运行时无关，已由 `verify-harness.cjs` 单独门禁。
