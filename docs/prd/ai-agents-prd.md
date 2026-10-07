---
last_updated: 2026-10-07
status: active
owner: yanha
---

# M5 多智能体五专家注册 — 需求文档（PRD）

> 切片：P0-1a（工程单 PLAN-harness-research-2026-10.md）· 版本：v1.0（2026-10-07）· 状态：**待用户确认**
> 前置：M5-S1（Orchestrator + librarian，47c4a81b）✅；M5-S2（pgvector/8 表 RAG，4d79c70+6634677）✅
> 本文为需求分析产物；用户确认后才进方案设计（AGENTS.md §13 需求分析先行）。

## 1. 背景与目标

一盏茶 M5 已建成 AgentOrchestrator 路由骨架 + librarian 茶文化学者试点（RAG 检索 + 专家 prompt + sources 来源标注）。本次把剩余四专家注册上线：荐茶师（advisor）/品鉴师（taster）/冲泡师（brewer）/成长导师（mentor），完成"数字茶室五角色"多智能体闭环（重构核心目标②的 M5 阶段）。

**业务目标**：显式指定 agent 时，用户获得该角色专业化回答（专业定位 + 领域检索 + 来源标注）；无指定时行为不变（文化意图→librarian，其余回落透明代理，承重墙保留）。

## 2. 竞品分析（茶域 AI 助手 + 通用多专家模式）

| 竞品 | 形态 | 相关能力 | 对一盏茶的启示 |
|---|---|---|---|
| 茶小牛 AI 泡茶机（清华团队，2026 新品） | 硬件 + AI 茶艺大模型 | 理解用户意图与情绪匹配泡法（推荐型 AI）；讲解茶文化知识（=librarian）；600+ 茶适配（=brewer 参数库） | 硬件已验证"AI 茶艺师"概念；软件形态是差异化空间；"意图→匹配"是推荐型专家（advisor）的同类范式 |
| 品察钛 Ai 智能水壶 | 硬件 + 语音品茶助手 | 对话式泡茶指令（"泡凤凰单丛→水温 98℃"） | 对话式交互验证：冲泡参数问答是高频场景（brewer） |
| 小罐茶泡茶机 T1 | 硬件胶囊机 | 四维智能冲泡、茶胶囊全品类 | 参数标准化路线；非 AI 对话，参考价值有限 |
| 悦泡 App | 软件 | 茶叶识别 / 泡茶方案 / 知识库 / 泡茶日志 | 知识库+日志组合 = librarian+taster；日志分析是品鉴助手的可行形态 |
| ChatGPT GPTs / Claude subagents | 通用 AI 多角色 | 显式角色选择 vs 自动路由两种模式并存 | 市场已验证"多专家/多角色"范式：角色分离提升专业感与回答质量；显式选择（agent 参数）+ 自动路由（意图粗分）可共存 |

**结论**：多专家模式是 AI 助手主流范式；茶域竞品以硬件为主、软件多专家稀缺；一盏茶"数字茶室五角色"（荐茶/品鉴/冲泡/文化/成长）是差异化定位，且与已有知识库（8 表 RAG）、品鉴记录、冲泡工艺数据天然匹配，不重复造轮子。

## 3. 市场分析

- 茶饮市场痛点（茶小牛 CFS2026 演讲）："不是缺好茶，是缺好的泡茶体验"——体验与服务化是共同方向。
- AI 助手分化：通用助手（ChatGPT/Claude）多角色成熟；垂直域（茶）智能助手软件稀缺，硬件先行。
- 一盏茶机会：把硬件已验证的"AI 茶艺师"体验软件化 + 沉淀用户数据（品鉴日志）→ 个性化（taster/mentor 基于用户记录的差异化价值，硬件无法复制）。
- 风险：AI key 成本与可用性（502 降级链已建）；多专家回答一致性（角色 prompt 需统一规则：不编造/待核实/≤200 字）。

## 4. 范围

### 4.1 做什么（In Scope）

| F-编号 | 功能 | 说明 |
|---|---|---|
| F-1 | advisor 荐茶师注册 | 检索 teas/regions/processes（复用 CultureSearchService）+ 荐茶 prompt（按口味/场景/时节推荐）→ 回复附茶名来源；计量 agent=advisor |
| F-2 | taster 品鉴师注册 | 检索用户品鉴记录（TastingRecordService/Repository）+ 口感分析 prompt（八维评分解读）→ 回复附记录茶名来源；计量 agent=taster |
| F-3 | brewer 冲泡师注册 | 检索 processes/teawares（复用 CultureSearchService）+ 冲泡参数 prompt（水温/器型/注水）→ 回复附工艺/茶器来源；计量 agent=brewer |
| F-4 | mentor 成长导师注册 | 基于用户品鉴记录 + 茶文化常识的成长引导 prompt（阶段建议/下一步尝试）→ 回复附依据来源；计量 agent=mentor（XP 数据未后端化，见 4.2） |
| F-5 | Orchestrator 路由扩展 | 显式合法 agent（6 个枚举）→ 对应专家/回落；显式未知 agent → 400（不变）；无 agent 文化意图粗分 → librarian（不变） |
| F-6 | 专家通用契约 | 内置 prompt 常量（版本化表 S2 换）；sources 来源字段；key 缺失/上游失败 → 502（前端 teaAI.ts 降级链）；计量旁路（失败不影响响应） |
| F-7 | 测试覆盖 | 每专家：检索命中 prompt 构造、key 缺失 502、LLM 失败 502、sources 组装；Orchestrator 路由矩阵扩展 |

### 4.2 不做什么（Out of Scope）

- S3 Graph 组合工作流（多专家协同）——后续切片
- 混合检索向量路径 / embedding 回填（P0-1c，依赖 AI key）
- 会话记忆读写（P0-1b，ai_chat_sessions 表就绪待 S2）
- agent_prompts 表版本化替换（S2）
- mentor 接入成长 XP 数据（成长体系后端未建，P1-8 茶园/成长切片前置）——本切片 mentor 用品鉴记录 + 常识引导，数据接入后升级
- 前端 agent 选择 UI / 专家展示样式（后端契约先行；前端由 P1-7 RAG 引用展示承接）
- 未知 agent 兼容旧自由字符串（S1 已收紧为 400，保持）

## 5. 验收标准（F-编号 + Given-When-Then）

- **F-5 路由**：GIVEN 请求带 `agent=advisor|taster|brewer|mentor` WHEN 调用 /api/v1/ai/chat THEN 路由到对应专家（非透明代理）。
  GIVEN 请求带 `agent=unknown` WHEN 调用 THEN 400 PARAM_INVALID。
  GIVEN 请求无 agent 且含"茶"类关键词 WHEN 调用 THEN 路由 librarian（回归不变）。
- **F-1~F-4 专家**：GIVEN 合法 agent + 有效 key WHEN 调用 THEN 回复内容含对应角色定位、命中时含知识来源（sources 非空），计量落 agent=对应类型。
  GIVEN key 缺失/disabled WHEN 调用 THEN 502（BadGatewayException）。
  GIVEN 上游 LLM 失败 WHEN 调用 THEN 502；计量失败不影响已成功响应。
- **F-6 契约**：GIVEN 知识库未命中 WHEN 调用 THEN 明确标注"知识库未命中，以下为常识回答"；回答 ≤200 字（prompt 约束）。
- **F-7 测试**：GIVEN 运行 `mvn -q test` THEN 新测试 + 既有 93 测试全绿（回归）。

## 6. 影响分析

| 对象 | 影响 |
|---|---|
| AgentOrchestrator | routeToLibrarian → 泛化 routeToAgent（返回 AgentType）；CULTURE_KEYWORDS 粗分逻辑不变 |
| AiChatService | 增加 4 个 Agent 依赖；switch 派发（保留回落透明代理分支） |
| 新增 4 类 | AdvisorAgent / TasterAgent / BrewerAgent / MentorAgent（LibrarianAgent 模式复用：检索→prompt→LLM→sources→计量） |
| AiChatController / AiChatRequest | 不变（agent 参数已支持） |
| ai_usage_logs | agent 字段记对应枚举（表已支持） |
| 前端 | 无破坏性变更（teaAI.ts 降级链保留；agent 可选参数） |
| 测试 | AgentOrchestratorTest 路由矩阵扩展 + 4 个新 Agent 测试（模式复用 LibrarianAgentTest） |
| 文档 | AGENTS.md/工程结构无需变更（无新增表/无 L3 架构改动）——验证级别 L2 |

## 7. 验证级别与流程

- Modification Level：L2（业务逻辑/服务）→ 最低验证 `mvn -q test` + 冒烟（4 专家显式调用）。
- 完成标准：mvn test 全绿 + 手工冒烟（advisor/taster/brewer/mentor 各一发，无 key 时 502 降级验证）→ review（多轮迭代）→ commit。

## 8. 待确认问题

1. mentor 本切片用"品鉴记录 + 常识"引导（XP 后置）——是否接受？还是等 P1-8 成长体系后再注册 mentor？
2. 各专家 prompt 的"角色人设"是否需要我按竞品模式（茶小牛"意图理解+讲解"）细化语气/篇幅？默认按 librarian 现有规则（≤200 字/不编造/待核实）。
