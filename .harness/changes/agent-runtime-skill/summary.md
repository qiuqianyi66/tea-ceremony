---
last_updated: 2026-10-09
status: active
owner: yanha
---

# agent-runtime-skill 变更记录（T08，ADR-017）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | agent-runtime-skill（运行时领域技能第一版） |
| 分支 | 直接落 main（T08 独立 commit） |
| 需求来源 | REQ-ai-project F-B1 + ADR-017 |
| 类型 | feat |
| 涉及范围 | 后端（迁移 V6 / AgentSkillRouter / LibrarianAgent 注入） |

## 二、需求与方案

### 需求描述

1. 茶文化问题按领域（茶器/茶诗/产区/茶人）注入子指令，专业口径可运营。
2. 未命中领域不膨胀上下文；prompt 版本化承重墙不变。

### 技术方案

- Flyway V6 `agent_skills`（agent+domain 唯一，status active，种子 4 条引导性规则）。
- `AgentSkillRouter`（@Component）：`detect(question)` 固定顺序关键词命中（LinkedHashMap）；`load(agent, domain)` 取 active（无 → 空串）。
- 注入点：`LibrarianAgent.chat()` RAG 后、LLM 前，命中则拼 `【领域技能·domain】`；未命中不加。

## 三、影响分析

- 影响面：后端 AI 域（LibrarianAgent 构造器 +1 依赖 spring 注入）。
- 契约变化：无（system prompt 内部扩展，HTTP 契约不变）。
- 承重墙确认：`promptService.getPrompt` 回退内置常量不变；skill 空回退不改变原行为（未命中=不加）。
- 回滚：revert commit 或 DROP TABLE（rollback.sql 已验证往返）。

## 四、自检清单

- [x] 迁移成对：V6 + rollback.sql 容器 PG 往返验证
- [x] 测试全绿：AgentSkillRouterTest 7 用例 + AgentSkillRouterIntegrationTest 3 用例 + mvn 全量
- [x] ADR-017 已落 docs/ADR/（L3 新表必须）
- [x] 编码规范红线零违反（待 audit-redlines 终检）
