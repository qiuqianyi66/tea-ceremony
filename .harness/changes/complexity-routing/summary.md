---
last_updated: 2026-10-09
status: active
owner: yanha
---

# complexity-routing 变更记录（T09）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | complexity-routing（请求复杂度三档路由） |
| 分支 | 直接落 main（T09 独立 commit） |
| 需求来源 | PLAN-final-convergence T09（复杂度路由） |
| 类型 | feat |
| 涉及范围 | 后端（AgentOrchestrator / AiChatService / application.yml） |

## 二、需求与方案

### 需求描述

1. 按输入字数/轮次分三档：SIMPLE 直答 / MEDIUM 专家路由+RAG / COMPLEX 上下文压缩。
2. 阈值配置化（tea.ai.complexity.*），默认 40 字 / 3 轮 / 200 字。

### 技术方案

- `ComplexityLevel`（SIMPLE/MEDIUM/COMPLEX）+ `AgentOrchestrator.complexity(req)` 纯计算（字数=最后用户消息长，轮次=user 消息数）。
- 行为生效于 `AiChatService.chat()`：SIMPLE + 隐式路由 → type 置 null 走透明直答（省 token/RAG）；显式 agent 尊重用户选择；COMPLEX → anchor 历史截断 20→5 条（上下文压缩）。
- 配置：`tea.ai.complexity.{simple-max-words,simple-max-turns,complex-min-words}`（环境变量可覆盖）。

## 三、影响分析

- 影响面：后端 AI 域（Orchestrator 构造器 +3 参数 @Value；AiChatService.chat 分支）。
- 契约变化：无（HTTP 契约不变；SIMPLE 直答响应结构同透明代理）。
- 承重墙确认：MEDIUM=现行为；SIMPLE 只影响隐式路由（显式 agent 不变）；COMPLEX 压缩仅收紧锚定条数。
- 回滚：revert commit 即可（无迁移）。

## 四、自检清单

- [x] 单测：AgentOrchestratorTest 三档边界 6 用例 + AiChatServiceTest 行为 3 用例
- [x] mvn 全量 201 tests exit=0
- [x] 配置化阈值 + 环境变量覆盖
- [x] 无新表（L2，无需 ADR）；注释不引用虚构 ADR
