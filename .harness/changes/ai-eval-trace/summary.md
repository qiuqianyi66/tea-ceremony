---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-trace 变更记录（T07，ADR-016）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-eval-trace（AI 评测四层归因 Trace） |
| 分支 | 直接落 main（T07 独立 commit） |
| 需求来源 | REQ-ai-project F-A1（四层归因 Trace）+ ADR-016 |
| 类型 | feat |
| 涉及范围 | 后端（迁移 V5 / TraceRecorder / AiChatVo 旁路字段） |

## 二、需求与方案

### 需求描述

1. AI 评测可归因：每次对话落四层现场（输入/上下文/规划/执行）+ 结果与效率。
2. 旁路埋点：不改变 AI 主流程（502 降级承重墙、会话记忆、幂等）。

### 技术方案

- Flyway V5 `ai_eval_traces`（append-only，session_id 可空=游客，四层 JSONB + output/tokens/latency/error_code）。
- `TraceRecorder`（@Component）begin→complete/fail 生命周期，旁路保存（失败仅 warn）。
- 埋点单点：`AiChatService.chat()` 入口（透明代理与五专家共用），不侵入 agent 内部。
- `AiChatVo` 增 tokensIn/tokensOut/latencyMs 旁路字段（jackson non_null，前端不感知）；`BaseExpertAgent.toVo` 与 `transparentChat` 从 ChatResponse Usage 填充。

## 三、影响分析

- 影响面：后端 AI 域（AiChatService 构造器 +1 依赖 spring 注入；controller 测试 mock service 不受影响）。
- 契约变化：AiChatVo 序列化增 3 个可空字段（前端兼容）；wiki/api-contract.md 无需更新（响应体扩展向后兼容）。
- 承重墙确认：埋点只读不写主流程；502 路径 catch 后 rethrow，降级链不变；游客 sessionId=null 不落会话。
- 回滚：revert commit 或 DROP TABLE（rollback.sql 已验证往返）。

## 四、自检清单

- [x] 迁移成对：V5 + rollback.sql 容器 PG 往返验证（up count=1 → down count=0）
- [x] 测试全绿：TraceRecorderIntegrationTest 2 用例 + mvn 全量 182 tests exit=0
- [x] ADR-016 已落 docs/ADR/（L3 新表必须）
- [x] 编码规范红线零违反（待 audit-redlines 终检）
