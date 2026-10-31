---
title: Tea 全面升级执行任务树
last_updated: 2026-10-29
status: active
owner: yanha
source: PLAN-comprehensive-upgrade-2026-10-29.md（战略层，本文件是执行层）
---

# Tea 全面升级执行任务树（部分 → 板块 → 代码单元）

> 执行方式：每个「部分」独立分支并行；每个「代码单元」= 文件 + 改动点 + 预期行为 + 验收。
> 验收三选一：测试全绿 / 命令实测 / 容器验证。完成即记录，勿跳验收。
> 分支命名：feature/b2-docs、feature/b11-vector-rag、feature/b12-tools、feature/b13-streaming、feature/b14-memory、feature/b3-product、feature/b4-hardening。commit subject 前缀 [ai]。禁 push main。

---

## Part 1: B2 口径修复（防面试翻车，最优先）

### 板块 P1.1 tea 仓内文档口径

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T1.1.1 | README.md | 评测数字 v3 0.81 → v8 0.95（50 条 full-judge），茶单 40 → 66 | grep 确认无 0.81/40 残留 |
| T1.1.2 | README.en.md | 同步 T1.1.1 | grep 无残留 |
| T1.1.3 | docs/ai-eval/ITERATIONS.md | 口径统一：v6 行去掉「当前最新可引用」，标注 v8 为最新；注 5 同步 | 全文无「v6…最新」矛盾句 |
| T1.1.4 | docs/architecture/system-overview.md | pgvector/向量检索措辞「在用」→「预留/规划中」；嵌入检索写清「当前 ILIKE 文本层」 | grep 无「pgvector 已用于线上」类句 |
| T1.1.5 | docs/ai-eval/PORTFOLIO-EVIDENCE.md | §2 表加「向量检索未上线（欠费阻塞，B3 自托管规划中）」诚实注 | 文档可读性自查 |

### 板块 P1.2 简历文件口径
- T1.2.1 **需用户提供简历文件路径**（桌面/Career OS 项目均未发现候选，勿猜）→ 拿到后：pgvector/向量 RAG「在用」措辞改「规划中」、评测数字对齐 v8、茶数据规模对齐 66。

---

## Part 2: B1 四方向 AI 深化（四条线并行）

### 板块 P2.1 向量 RAG 落地（最长链，先开工）

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T2.1.1 | backend/pom.xml | + onnxruntime-java 依赖（版本与 JDK17 兼容） | mvn compile 过 |
| T2.1.2 | 新文件 backend/src/main/java/com/tea/culture/embedding/EmbeddingService.java | 封装 ONNX 推理：loadModel(modelPath) + encode(text)→float[1024]；模型用 **bge-large-zh-v1.5 ONNX**（子代理已核实：bge-small-zh 512 维不匹配现有 vector(1024)，bge-large-zh-v1.5 1024 维匹配，无需迁移 schema）；模型文件放 D:\models\（禁提交 repo） | 单测：encode 确定性 + 维度 1024 + 同义句余弦 > 随机句 |
| T2.1.3 | 现有 admin backfill 管道（/api/v1/admin/backfill，X-Admin-Token） | embedding 写入改走 EmbeddingService（替换欠费 DashScope 客户端）；embed=true 生效 | 带 token 实测：culture_chunks 行数 > 0 且 embedding 非空；容器日志无 Arrearage |
| T2.1.4 | backend/src/main/java/com/tea/culture/service/CultureSearchService.java | 混合检索：ILIKE 文本层 + pgvector cosine 层（HNSW 索引已在 V3 迁移），结果融合去重；vector 不可用时静默降级文本层（承重墙不变） | 集成测试：向量命中 case 全绿 + 手工 curl 黑茶/乌龙命中不回归 |
| T2.1.5 | scripts/eval-tea-ai.cjs | 增加 RAG 召回质量指标：recall@k（sources 命中率 + 命中是否进入回答引用） | eval dry-run 可输出新指标字段 |
| T2.1.6 | 评测重跑 | node scripts/eval-tea-ai.cjs --judge --iterations 1 --login eval_tea_2026:EvalTea@2026pass --delay 13000 | RAG 命中率对比 v8 0.38 → 记录新值；ITERATIONS.md 追加 v9 |

### 板块 P2.2 多工具 Agent（function calling）

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T2.2.1 | backend/src/main/java/com/tea/ai/tool/*.java（新） | Spring AI @Tool 四工具：检索文化库 / 冲泡参数计算 / 品鉴记录查询 / 冲泡建议生成（蓝图 D6 定 4 个） | 单测：每个工具参数校验 + 纯逻辑正确 |
| T2.2.2 | backend/src/main/java/com/tea/ai/service/AiChatService.java | 工具注册进 ChatClient；LLM tool_calls → 执行 → 结果回填 → 最终回答的循环；工具调用失败不阻断主回答 | 集成测试：触发工具调用的输入得到带工具结果支撑的回答 |
| T2.2.3 | 前端 src/services/teaAI.ts（承重墙） | agent 选择/降级逻辑不动；仅确认工具结果经 messages 回传（若无前端改动则标注无需动） | type-check + build 过 |
| T2.2.4 | docs/ai-eval 评测集 | 新增 2-3 条工具调用考点（如「帮我算 150ml 盖碗投茶量」「查一下铁观音记录」） | 评测集 +1 组 case，跑分记录 |

### 板块 P2.3 流式输出

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T2.3.1 | backend AiChatController + AiChatService | 新增流式端点（SseEmitter 或响应流），逐 chunk 下发；保留非流式端点（兼容旧前端/评测） | curl --no-buffer 实测逐字到达；非流式端点不回归 |
| T2.3.2 | 前端 src/services/teaAI.ts | fetch stream 解析（SSE 事件 → 文本累积）；30s 超时/降级保留 | 浏览器实测逐字渲染；断流走规则降级 |
| T2.3.3 | 前端 src/components/AIAsk.vue（或对应渲染组件） | 流式增量渲染 + 停止按钮 | type-check + build；手测中断 |

### 板块 P2.4 长期记忆

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T2.4.1 | docs/ADR/ADR-0XX.md + backend/src/main/resources/db/migration/V4__user_memory.sql | 新表 user_memory（user_id、key、value、updated_at、summary 摘要表或单表标志位）；ADR 写选型+回滚 | Flyway upgrade/downgrade 往返测试过 |
| T2.4.2 | backend/src/main/java/com/tea/ai/service/ChatMemoryService.java（扩展） | 会话结束触发：LLM 抽取关键信息（偏好/忌口/常用茶器）→ 写 user_memory；旧摘要压缩合并 | 集成测试：两轮会话后画像表有抽取记录 |
| T2.4.3 | AiChatService 注入 | 新会话开场把 user_memory 摘要注入 system prompt（不泄露原始敏感字段） | 集成测试：第二会话回答体现画像（如记住忌口） |

---

## Part 3: B3 产品补全（待用户圈定范围后执行）

- 蓝图 §4 决策点 D5/D7 用户未拍板的产品项（功能密度/留存机制）。**执行前置：用户圈定后本 Part 才开工**，勿擅自加功能（YAGNI 红线）。

---

## Part 4: B4 工程硬能力（基于子代理盘点报告补缺口）

| 单元 | 文件 | 改动点 | 验收 |
|---|---|---|---|
| T4.1 | 按「工程硬能力盘点报告」缺口清单 | 遥测/性能/安全报告已实测大部分达成，仅补清单标注的缺口项 | 按报告逐项核验 |
| T4.2 | CI 或 scripts | 若盘点发现门禁缺口（如 eval dry-run 未挂 CI）补上 | verify-harness 期望 ERRORS: [] |

---

## Part 5: B5 收尾

| 单元 | 动作 | 验收 |
|---|---|---|
| T5.1 | 各分支 PR 合并（用户操作或授权） | main 干净 |
| T5.2 | PORTFOLIO-EVIDENCE.md 全量更新（四方向章节 + B2 口径） | 无 TBD 残留 |
| T5.3 | 简历文件（P1.2 路径到手后）数字对齐 | 与 ITERATIONS.md 一致 |

---

## 依赖与并行

```
P2.1(最重) ─┬─ T2.1.1→2.1.2→2.1.3→2.1.4→2.1.5→2.1.6（串行链）
P2.2 ── 独立（可与 P2.1 并行，共用 CultureSearchService）
P2.3 ── 独立（改 chat 响应形态，注意与 P2.2 tool_calls 流事件边界：先文本流，工具流留待集成）
P2.4 ── 独立（新表，与 P2.1/P2.2 无依赖）
P1（B2 口径）── 可先行（不等任何方向）
P3 ── 等用户圈定
P4 ── 读盘点报告后独立
```

## 执行纪律（每个单元）

1. 先读文件再改（AGENTS.md 规则）；每行改动可追溯到本树某单元。
2. 验收必须真跑（测试/命令/curl），不声明替代实测。
3. 新表 = L3：ADR + Flyway + 往返测试（T2.4.1 已含）。
4. 遇到蓝图决策点未拍板的（D5/D7）→ 停该单元，列选项报用户，不静默选择。
5. 临时产物 .tmp/<会话>-<时分>/。
