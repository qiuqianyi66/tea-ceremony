---
title: Tea AI 工程深度证据（作品集/面试用）
last_updated: 2026-10-28
status: active
owner: yanha
scope: 简历与面试举证专用——数字只取 ITERATIONS.md 已记录版本，不编
---

# Tea AI 工程深度证据

> 用途：AI 应用工程师 / LLM 应用开发实习生投递举证。本文件回答「这个项目 AI 到底深在哪」，全部结论有代码与评测报告可追溯。
> 口径纪律：评测数字一律引自 `docs/ai-eval/ITERATIONS.md` 版本表 + `docs/ai-eval/reports/`；RAG 命中率单独标注（与 overall 不同口径）。

## 0. 一句话定位

Tea 不是「调 API 的聊天机器人」，而是一个**带可验证评测体系的 Agent 系统**：5 专家路由 + LLM-as-Judge 自评 + RAG 检索 + 记忆 + 熔断降级，且每一层都有数字与测试支撑。

## 1. 核心机制清单（面试可展开项）

| 机制 | 实现位置 | 证据 |
|---|---|---|
| 5 专家 Agent（advisor/taster/librarian/brewer/mentor） | 后端 AiChatService + AgentOrchestrator 隐式路由 | 文化关键词→LIBRARIAN，其余透明代理；complexity 三档路由 |
| LLM-as-Judge 评测 | `scripts/eval-tea-ai.cjs` + `scripts/calibrate-judge.cjs` | 50 条评测集 / 98 考点 / judgeCoverage=1 全量判分 |
| pass^k 判定 | 评测器（--iterations k） | v7 men 子集 8 条 pass³ 6/8 |
| RAG 检索（当前 ILIKE + 类目直查） | `CultureSearchService` | teas/people/regions/poems/teawares/etiquettes/processes 七表；B1 加 category 直查 + 类目别名 |
| 对话记忆 | `ChatMemoryService`（会话级上下文注入） | chat 请求带 history |
| 熔断 + 降级 | 后端 CircuitBreaker/降级链 + 前端 `teaAI.ts` | 30s AI 超时 / 5s RAG 超时 / 规则回复兜底 |
| AB 实验 | 后端分流 | /api/v1/ai/chat 分流记录 |
| MCP Server | `CultureSearchTool`（SSE /mcp 端点） | 检索工具暴露为 MCP 协议 |
| 管理 backfill 管道（含安全审计） | /api/v1/admin/** + X-Admin-Token | Fail-closed，未配 token 全部 401 |
| 网关通道与人设链路排查 | 前端→yg-gateway→上游 LLM | 见 §3 案例 |

## 2. 评测数字（口径：50 条全量 full-judge，deepseek 通道）

| 版本 | 日期 | overall | programOnly | pass^1 | RAG 命中率 | 备注 |
|---|---|---|---|---|---|---|
| v6 | 2026-10-18 | 0.90 | 0.95 | 41/50 | 0.16 | 全量 judge 复跑基线 |
| v8-preB1 | 2026-10-28 | 0.95 | 1.00 | 45/50 | 0.38 | 干净基线（网关通道修复后；与并发实例重叠 8 分钟，参考） |
| v8-postB1 | 2026-10-28 | 0.95 | 1.00 | 45/50 | 0.38 | B1 类目直查后（干净单实例） |

> **B1 诚实结论**：B1（类目直查）在评测集上未提升 RAG 命中率（0.38 持平）——评测集类目词 case 未成规模；但运行时手工验证命中真实生效（"黑茶怎么泡"→5 黑茶、"乌龙茶和武夷岩茶"→青茶、"紫砂壶泡黑茶"→teawares 2）。RAG 0.16→0.38 的主因是评测链路修复（认证档 30/min 无 429 + 端口对齐实测网关），不是 B1。
> 注：2026-10-28 另修复欠费下每次检索白调 DashScope embedding 的问题（gateway profile 排除 `DashScopeEmbeddingAutoConfiguration`，容器日志实测 400 Arrearage 消失）。
> **向量检索未上线**：DashScope embedding 通道因账户欠费阻塞（实测 400 Arrearage）；B3 自托管 embedding（bge-m3 ONNX + pgvector）规划中。当前线上检索 = ILIKE 文本层 + B1 类目直查，向量 RAG 未参与回答生成。

## 3. 面试叙事案例（真实排查，可深挖）

### 3.1 网关删人设排查（跨系统链路问题）
- 现象：chat 回复不像茶灵。
- 排查链：前端 teaAI.ts 带 system prompt → 后端原样转发（AiChatService 无篡改）→ **yg-gateway handler.go:1000-1005 custom 模式删除客户端 system 换成网关 persona** → passthrough 恢复后仍偶发漏人设 → 定位为上游 CodeBuddy 账号池**服务端会话上下文**（账号级 persona 压过客户端 system）。
- 结论：客户端 system 在账号池会话模型下不可压服，属上游行为；Tea 侧代码无缺陷。
- 举证价值：能讲清「你的 prompt 到模型前经过的每一跳」——多层代理、透传、会话上下文优先级。

### 3.2 评测数字的口径陷阱（谁信谁被坑）
- v1/v2 的 0.82/0.96 是 `judge off` 的 program-only 口径（未跑 judge 考点中性计 1）→ 2026-10-09 修正为「未回填计 0」后同批 dry-run overall=0.19，programOnly=1。
- 教训：**judgeCoverage=1 的数字才能跨版本比**；v7 的 1.00 只在 8 条 men 子集成立，不可写进简历。
- 举证价值：展示对评估方法论的理解（覆盖口径、假阳性、子集误用），比「我分数高」更可信。

### 3.3 RAG 从 0.16 → 0.38（B1 未改评测集数字，运行时命中真实生效）
- 根因：culture_chunks 表 0 行（从未 backfill）+ 评测环境显式禁用 embedding（占位 key 401）+ DashScope 账户欠费（实测 400 Arrearage，embedding 通道不可用）。
- 对策分层：A 向量 RAG（被欠费阻塞，未硬上）→ **B1 纯文本类目直查**（零成本立即可用：teas 查询加 category 匹配 + 类目别名乌龙茶/岩茶→青茶 + 别名展开上限约束）→ B3 自托管 embedding（bge-m3 ONNX + pgvector，预留）。
- 诚实归因：评测集上 RAG 0.38 前后持平（B1 影响的类目词 case 未成规模），0.16→0.38 提升来自评测链路修复（认证档 30/min 无 429 污染 + 端口对齐 7863）；B1 价值经运行时验证（黑茶/乌龙/紫砂手工命中，此前必 miss）。
- 举证价值：展示**先实测根因、不硬套方案、欠费就换零成本通道、数字如实归因**的工程取舍。

## 4. 一句话可复述的「深度证明」

「Tea 的 AI 层不是堆 prompt：它有一个 50 条评测集 + LLM 独立评委 + 覆盖口径纪律（judgeCoverage=1）的自评系统，把整体分从 0.81 推到 0.95、program 正确率推到 1.0，并用 RAG 命中率单独追踪检索短板；每个机制（专家路由/记忆/熔断/MCP/backfill 审计）都有代码、测试和真实排查案例。」

## 5. 待补充

- [x] v8-postB1 数字回填（§2 表格，0.95 / 持平 0.38）
- [x] ITERATIONS.md 追加 v8 版本行
- [ ] 网关排查案例补 yg-gateway 配置还原证据（D:\yg-gateway\config.json.bak-20261028）
- [ ] B3 自托管 embedding（bge-m3 ONNX + pgvector）落地后更新 RAG 数字——欠费下向量通道恢复的唯一路径
