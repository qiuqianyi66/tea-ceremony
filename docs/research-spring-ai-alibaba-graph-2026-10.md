---
last_updated: 2026-10-09
status: active
owner: yanha
---

# Spring AI Alibaba Graph 精读：《HR 招聘全流程 workflow-agent 实战》（2026-10-09）

> 来源：语雀《7.Spring Ai Alibaba Graph〈Hr招聘全流程workflow-agent实战〉》
> https://www.yuque.com/geren-t8lyq/ncgl94/nbml39fvzoagg1tq
> 配套代码：https://gitee.com/xscodeit/spring-ai-alibaba-xs/tree/main/hr-recruitment-agent
> 本地快照：`.tmp/sa-xs/`（course-1~6 + hr-recruitment-agent + flight-booking + text-to-sql）
> 本文 = 文档精读 + 源码实证 + 框架 jar 反编译核对 + **跑图实测反驳** + 一盏茶可迁移清单。
>
> ⚠️ **阅读顺序警告**：§1-§8 是按「文档叙事」整理的，其中若干条已被 §9 实测**推翻**。
> 引用本文结论前**必须先读 §9**。§0 第 4 条（旧"三条工程经验"）已作废，见 §9.1。
>
> **三块内容分工**：
> - §1-§8 = 文档叙事整理（**部分被推翻**，以 §9 为准）
> - §9 = 实测反驳（**可信度最高**，跑出来的）
> - §10 = 全课程规范代码提炼（course-1~6，API 已 javap 核对，**这是课程主体价值**）
> - §11-§12 = tea 迁移清单与待办

## 0. 结论先行

1. **Graph 定位**：不是 agent 框架，是 **agent 之下的一层有状态流程运行时**。它把「做什么」（Node）与「去哪里」（Edge）解耦，换来三件事——可观测（Mermaid）、可暂停（HITL）、可恢复（Checkpoint + 时间旅行）。（此条实证成立）
2. **一盏茶现状**：`backend/pom.xml` 未显式声明 graph-core，但 `spring-ai-alibaba-agent-framework:1.1.2.4-security-fix` 已**传递依赖** `spring-ai-alibaba-graph-core:1.1.2.4-security-fix`（已核对 .m2 中该 pom 第 38-40 行，并用 tea 后端 classpath 实跑通过）。**引入 Graph 不需要新增依赖**。（此条实证成立）
3. **与 H9 不冲突**：REQ-ai-project §4 砍掉的是「多 agent 接力流水线」。Graph 是确定性 workflow，用于「一次请求内部的多步有状态编排」，不改变 tea 现有的「单请求单专家路由」。
4. **教材可信度**：**低**。文档 3 处核心说法与实测行为不符，项目零测试、含真 bug、关键章节锁付费墙。**定位为「机制参考 + 反面模式库」，不是生产级样板**。详见 §9。
5. **实证方法**：本文 §9 的结论全部来自在 tea 后端 classpath 上跑真实 StateGraph（临时探针测试，跑完已删），不是读代码推测。

## 1. 22 个技术点清单（文档附录 B 全表）

| # | 知识点 | 基础示例场景 | 核心教学点 |
|---|---|---|---|
| 1 | StateGraph | 打招呼图（Hello → Goodbye） | 2 节点图，建立「画布」概念 |
| 2 | NodeAction | 学生成绩处理 | 三种节点接口：同步/异步/带配置 |
| 3 | 顺序边 | 审批流（提交→审查→批准） | 线性流程 |
| 4 | 条件边 | 分数判定（≥60 通过） | **节点写决策、边读决策，读写分离** |
| 5 | 并行边 | 文档分析（字数+关键词+语言） | 多源同汇=并行，**配 Executor 才真并发** |
| 6 | ~~动态并行~~ | ~~智能任务分发器~~ | 已划掉（框架限制：并行目标必须同一汇聚点） |
| 7 | ~~聚合策略~~ | ~~LLM 竞速（ALL_OF/ANY_OF）~~ | 已划掉 |
| 8 | CommandAction | 重写分数判定 | 节点自己决定路由 vs 条件边路由 |
| 9 | OverAllState | 文本处理器（字数→摘要→报告） | 节点间共享状态读写 |
| 10 | KeyStrategy | Replace vs Append | 多写场景必须 Append |
| 11 | 编译执行 | invoke vs stream | 同步拿结果 vs 逐步观察 |
| 12 | 流式输出 | 三种事件类型 | NodeOutput / StreamingOutput / InterruptionMetadata |
| 13 | RunnableConfig | 不同 threadId 隔离 | threadId 是状态隔离边界 |
| 14 | CompileConfig | interruptBefore 审批暂停 | 编译时静态中断 vs 运行时动态中断 |
| 15 | Checkpoint | 3 节点图检查点历史 | 自动保存，每节点一快照 |
| 16 | HITL | 金额>1000 需审批 | InterruptableAction 条件判断 |
| 17 | 断点续传 | HITL 五步曲 | 最核心操作流程 |
| 18 | 时间旅行 | 回看执行历史 | getStateHistory + checkPointId |
| 19 | 子图 | 文档分析子图封装 | 子图独立 schema，主图只看一个节点 |
| 20 | 生命周期 | 执行耗时监听器 | GraphLifecycleListener = Graph 的 AOP |
| 21 | 可视化 | 生成 Mermaid | 代码→图表 |
| 22 | 长期记忆 | 跨会话用户偏好 | Store = LocalStorage，OverAllState = SessionStorage |

项目**未使用**：#8 CommandAction、#20 GraphLifecycleListener、#22 Store。

> ⚠️ 本表 #5「配 Executor 才真并发」已被 §9.2 实测推翻。
> ⚠️ 文档自身矛盾：标题写「共 20 个」，附录表列到 #22；#16 HITL / #18 时间旅行 / #19 子图 / #20 生命周期 四节正文标「需通过 vip 课程学习」= **付费墙，正文为空**（§9 对应结论均为源码实证所得，非文档正文）。

## 2. 项目架构（源码实证）

### 2.1 双图层级

```
【主图 HrGraph】new StateGraph("HrGraph", mainKeyStrategy)   ← 命名（Mermaid 要露脸）
START → parse_resume → screen_resume
        ├─ REJECT → reject → END
        └─ PASS   → deep_eval ──┐
                                ↓
              candidate_submit [HITL-1 等候选人交答案]
                ├─ timeout   → reject → END
                └─ submitted → answer_score
                                ├─ fail → eval_reject → reject → END
                                └─ pass → hr_interview → tech_interview → final_interview
                                            → background_decision
                                              ├─ fail → reject → END
                                              └─ pass → offer_gen → offer_approval [HITL-2 HR 审批]
                                                          ├─ reject_offer → reject → END
                                                          └─ approve → send_offer → END

【deep_eval 子图】new StateGraph(subKeyStrategy)             ← 匿名（嵌入节点不露脸）
START ─条件边:targetPosition→ frontend_scorer / java_scorer / algorithm_scorer
      ─────────────────────┬→ experience_scorer ─┐
      ─────────────────────┴→ culture_scorer ────┤（5 路并行）
                                                 ↓
                    score_aggregator → gen_questions → send_questions → END
```

`HrRecruitmentWorkflow.java:118` 建子图，`:165` 编译，`:205` 建主图，`:211` 以 `addNode("deep_eval", deepEvalCompiled)` 嵌入。

### 2.2 节点盘点：17 + 2 + 2

- **17 个独立 NodeAction**（`hr/nodes/`，全部 `node_async()` 包装）：ParseResume / ScreenResume / 5 个 Scorer / ScoreAggregator / GenerateQuestions / SendQuestions / AnswerScore / 三轮面试 / OfferGenerator / SendRejection / SendOffer。
- **2 个 HITL 节点**（`AsyncNodeActionWithConfig` + `InterruptableAction`，写成 `HrRecruitmentWorkflow` 的 **private static 内部类**，L357 / L391）：`CandidateSubmitHitlNode`、`OfferApprovalHitlNode`。
- **2 个 Lambda 匿名节点**：`eval_reject`（L221）、`background_decision`（L236）。

### 2.3 状态字段

- 子图 14 个 key，主图 32 个 key，**只有 `messages` 用 AppendStrategy**，其余全 Replace。
- 设计原则（框架文档）：**状态存原始数据不存格式化文本**；**能派生的不存储**。
- 关键读写链：`input`(Controller) → `resume`(parse) → `next_node`(screen，供条件边) → `score_grade`(aggregator) → `candidate_status`/`offer_approved`(updateState 续传写入，供条件边)。

### 2.4 6 处条件边（全部 `edge_async` + 路由表）

| # | 源节点 | 路由依据 | 分支 |
|---|---|---|---|
| 1 | START（子图） | `targetPosition` 岗位方向 | frontend/java/algorithm → 对应 scorer |
| 2 | screen_resume | `next_node` | PASS→deep_eval / REJECT→reject |
| 3 | candidate_submit | `candidate_status` | submitted→answer_score / timeout→reject |
| 4 | answer_score | `score_pass` | pass→hr_interview / fail→eval_reject |
| 5 | background_decision | `bg_decision` | pass→offer_gen / fail→reject |
| 6 | offer_approval | `offer_approved` | approve→send_offer / reject_offer→reject |

## 3. 三个核心机制（带源码级细节）

### 3.1 HITL 三步曲（#16 + #17）—— 最容易踩坑

```java
// 节点：放行条件由节点自己判断（运行时动态，优于 compile 期 interruptBefore）
private static class OfferApprovalHitlNode implements AsyncNodeActionWithConfig, InterruptableAction {
    public CompletableFuture<Map<String,Object>> apply(OverAllState s, RunnableConfig c) { ... }
    public Optional<InterruptionMetadata> interrupt(String nodeId, OverAllState s, RunnableConfig c) {
        if (已批准) return Optional.empty();                    // 放行
        return Optional.of(InterruptionMetadata.builder(nodeId, s)
                .addMetadata("message", "等待 HR 审批 Offer...")
                .addMetadata("action", "POST /api/recruitment/approve/{threadId}")
                .build());                                       // 中断
    }
}
```

续传必须三步，缺一不可：

```java
// ① 用同一个 threadId 定位 checkpoint
RunnableConfig base = RunnableConfig.builder().threadId(threadId).build();
// ② 写入人工输入；nodeId 必须是【主图】中的 HITL 节点名
RunnableConfig updated = compiledGraph.updateState(base, Map.of("offer_approved", true), "offer_approval");
// ③ 打上人工反馈标记（缺这步框架会从头跑，不会续传）
RunnableConfig resume = RunnableConfig.builder(updated)
        .addMetadata(RunnableConfig.HUMAN_FEEDBACK_METADATA_KEY, "offer_approved").build();
// ④ input 传 null，状态从 checkpoint 恢复
compiledGraph.stream(null, resume).doOnNext(...).blockLast();
```

`course-6/src/test/.../TestHITL.java` 是最小可跑版本（105 行，无 LLM 依赖），可直接抄作单测模板。

> ✅ 本节机制**实证成立**：`InterruptionMetadata.builder(String, OverAllState)`、`CompiledGraph.updateState(RunnableConfig, Map, String)`、`RunnableConfig.HUMAN_FEEDBACK_METADATA_KEY` 三个签名已用 `javap` 核对真实 jar（见 §4）。
> ⚠️ 但「HITL 必须放主图」这条**是项目注释的自述，未经我实测**（我未构造子图内中断场景）。jar 中存在 `SubGraphInterruptionException` 可作旁证，但严格说仍是**未验证推论**。

### 3.2 并行（#5）—— 隐形约束

- 不需要声明并行：**同一源节点多条出边 + 汇聚到同一节点 → 框架自动生成隐式 ParallelNode**。
- 限制：只支持 Fork-Join，**只允许一层并行**（并行分支里不能再套并行）。
- ~~**不配 Executor 就是串行**~~ → **❌ 错，见 §9.2 实测推翻**。框架自带 `parallel-node-action-thread-N` 默认线程池；`addParallelNodeExecutor` 只是**替换**为自定义池，不是**开启**并行。
- ~~项目里 `deep_eval` = 1 个技能 scorer + 2 个通用 scorer 并行（3 路）~~ → **❌ 错，见 §9.1 实测推翻**。实际只跑 2 个节点：`experience_scorer` / `culture_scorer` **没有入边，永不执行**。

> ⚠️ **本节两条 bullets 原文保留但已划掉**，用于对照「文档说法」与「实测行为」。正确结论见 §9。

### 3.3 时间旅行（#18）

```java
Collection<StateSnapshot> history = compiledGraph.getStateHistory(config);
StateSnapshot target = history.stream().filter(s -> cpId.equals(s.config().checkPointId().orElse(""))).findFirst()...
if (target.next() 是 null/"END") → 拒绝重放（终点快照没有后续节点）
compiledGraph.stream(null, target.config()).blockLast();   // 直接用快照 config 恢复
```

控制器里 `/history/{threadId}` 列出快照、`/replay` 按 checkPointId 重放，前端可做成「回到某一步重跑」。

## 4. 框架 jar 反编译核对（1.1.2.4-security-fix）

从 `.m2/spring-ai-alibaba-graph-core-1.1.2.4-security-fix.jar` 提取的类，反推框架真实能力边界：

| 类 | 说明 / 推论 |
|---|---|
| `exception/SubGraphInterruptionException` | **子图内 HITL 有专门的异常类** → 印证项目 v3.0 把「HITL 全移到主图」是被逼出来的设计（子图内中断处理不稳） |
| `action/InterruptionMetadata$ToolFeedback` | HITL 不止「人工填值」，还支持**工具调用审批**（assistant 的 ToolCall 待人工确认），tea 的 MCP 工具可直接用 |
| `action/InterruptableActionWithConfig` | 带配置的中断接口变体 |
| `checkpoint/savers/VersionedMemorySaver` | 比 `MemorySaver` 更强的带版本检查点存储（生产应考虑） |
| `KeyStrategyFactoryBuilder` | KeyStrategy 可用 builder 构造，不必手写 `Map.ofEntries` |
| `CompiledGraph$StreamMode` | 流模式枚举（`streamSnapshots()` 可推快照流） |
| `internal/node/SubCompiledGraphNodeAction` | 子图两种嵌入形态：`addNode(id, StateGraph)` 与 `addNode(id, CompiledGraph)` |
| `utils/EdgeMappings` | 1.1.2.x 新路由表写法：`EdgeMappings.builder().to("pass").toEND().build()`，可替代 `Map.of` |

API 签名（javap 实测）：
- `CompiledGraph.updateState(RunnableConfig, Map<String,Object>, String nodeId)`
- `CompiledGraph.getStateHistory(RunnableConfig)`
- `InterruptionMetadata.builder(String nodeId, OverAllState)`
- `CompiledGraph.getGraph(GraphRepresentation.Type)` → MERMAID / PLANTUML

## 5. 反面模式与踩坑清单

### 5.1 实证成立的坑

| # | 坑 | 表现 | 修法 |
|---|---|---|---|
| 1 | **ReactAgent 当节点** | Mermaid 只显示 1 个黑盒节点，看不到内部逻辑 | 拆成 NodeAction（项目里 `com/example/agents/` 留下 9 个废弃 ReactAgent 做教学对比） |
| 2 | **节点无入边** | 图能编译、Mermaid 好看，但节点**永不执行**（§9.1 实测） | 每个节点必须有可达入边；用「执行了哪些节点」断言做回归 |
| 3 | **updateState 后不推进** | 状态改了但流程卡死（`/reject/{threadId}` 早期 bug，代码注释里留了「必须调 stream 推进」） | 必须 `stream(null, resumeConfig)` |
| 4 | **stream 是冷流** | 不 subscribe 不执行 | `.blockLast()` / `.subscribe()` |
| 5 | **用 invoke 检测中断** | `invoke()` 拿不到 `InterruptionMetadata` | 一律用 `stream()` |
| 6 | **路由表漏 key** | 路由函数返回路由表外的值 → 抛异常 | 路由表覆盖所有可能返回值，或加 default 分支兜底 |
| 7 | **CommandAction 路由** | 看代码看不出会路由到哪，Mermaid 画不出所有路径 | 优先条件边（路由表可可视化） |
| 8 | **MemorySaver 内存实现** | 进程重启检查点全丢 | 生产换持久化 Saver（jar 内有 `VersionedMemorySaver`，仍需评估） |

### 5.2 存疑未验证（原列于此，实测推翻或待证）

| # | 原说法 | 现状 |
|---|---|---|
| ~~A~~ | HITL 放子图 → `SubGraphInterruptionException` | **旁证未实测**：jar 有该异常类，项目注释自述。我未构造子图内中断场景验证 → 待证 |
| ~~B~~ | 并行不配 Executor → 串行 | **❌ 已推翻**，见 §9.2。框架自带默认线程池 |

### 5.3 Mermaid 不能当正确性证据

本项目的核心教训：**图好看 ≠ 行为对**。`deep_eval` 的 Mermaid 输出 5 条边汇聚，看着是漂亮的并行扇入；实测只有 2 个节点执行。项目作者批判 ReactAgent「黑盒，Mermaid 图看不到内部」，自己却栽在同一个陷阱里——**用可视化替代了验证**。

tea 若引入 Graph，验收标准必须是「断言执行了哪些节点」，不能是「Mermaid 图看起来对」。

## 6. 可复用代码骨架（tea 可直接改）

### 6.1 最小图（无 LLM，可当单测）

```java
KeyStrategyFactory strategy = () -> Map.of("data", new ReplaceStrategy());
CompiledGraph g = new StateGraph("Demo", strategy)
    .addNode("a", node_async(s -> Map.of("data", "A")))
    .addNode("b", node_async(s -> Map.of("data", "B")))
    .addEdge(START, "a")
    .addConditionalEdges("a", edge_async(s -> "go"), Map.of("go", "b"))
    .addEdge("b", END)
    .compile(CompileConfig.builder()
        .saverConfig(SaverConfig.builder().register(new MemorySaver()).build())
        .recursionLimit(30)      // 防条件边死循环，必配
        .build());
```

### 6.2 Spring 装配（CompiledGraph 做 Bean）

`WorkflowConfig.compiledGraph(ChatModel)` → 构建 + 编译 + 注册 Bean；Controller 注入 `CompiledGraph` 直接 `stream()`。tea 现有 `com/tea/ai/` 域可加 `TeaWorkflowConfig`。

### 6.3 三种对外接口形态

| 模式 | 端点 | 实现 |
|---|---|---|
| 同步 | `POST /start` | `stream() + blockLast()`，内部流式对外同步 |
| 流式 | `POST /start/stream` | `stream() + blockLast()`，返回聚合 JSON |
| SSE | `POST /start/sse` | `stream() + SseEmitter`，每节点实时推前端 |

SSE 是项目推荐形态（前端能看到「现在执行到哪个节点」）。tea 前端已有 `teaAI.ts` 降级承重墙，SSE 可作为增强而非替换。

## 7. 第一轮可迁移清单（已被 §11 取代）

> ⚠️ **本节是第一轮判断，部分已被 §9 实测推翻。以 §11 为准，本节保留用于对照。**

### 7.1 值得搬的（按性价比排序）

| 优先级 | 迁移项 | 落点 | 说明 | §11 修正 |
|---|---|---|---|---|
| P0 | **Graph 骨架 + Bean 装配** | `backend/src/main/java/com/tea/ai/graph/` | 依赖已就位（传递依赖，零新增）；先落一个 3 节点图验证编译 + Mermaid 打印 | 保留，但验收改为节点集合断言 |
| P0 | **HITL 三步曲模板** | 同上 | 冲泡流程天然需要人工介入（如「水已沸，请注水」），正是 InterruptableAction 场景 | 保留，必须配端到端测试 |
| P1 | **Checkpoint + 时间旅行** | `ai_eval_traces` 之外新增快照表或复用 | 与 ADR-016 Trace 形成互补：Trace 记录「发生了什么」，Checkpoint 支持「回到某步重来」 | **降 P2**，MemorySaver 重启即丢 |
| P1 | **Mermaid 可视化输出** | 启动日志 + `/actuator` 或管理端点 | 一张图讲清 AI 流程，简历/答辩素材 | 保留，但**不得当验收依据**（§5.3） |
| P2 | **ToolFeedback 工具审批** | MCP `CultureSearchTool` | 工具调用前人工确认，安全维加分 | 保留 |
| P2 | **VersionedMemorySaver** | 替换 MemorySaver | 内存 Saver 进程重启即丢，生产需换持久化实现 | 保留 |

### 7.2 候选落地场景（tea 语境）

```
【茶席导引 workflow】（确定性有状态，符合 H9 红线：不是多 agent 接力）
START → parse_intent（识别茶类/器/水）
      → fetch_tea_profile（查 src/data + 后端 tea 表）
      → brew_params（按茶类算水温/投茶/时长，走 tea-tasting 基准表）
      → 【HITL: 等待用户确认"水已沸"】
      → steep_timeline（分泡计时推进）
      → tasting_record（八维评分 × 工艺系数）
      → END
```

每一步都是现有能力的**编排重排**，不新增 agent、不违反「单请求单专家」。

### 7.3 明确不搬的

- **17 个独立 NodeAction 的手工拆分**：tea 不需要；先 3-5 节点起步，够用即止（AGENTS.md 最小实现）。
- **ReactAgent 版本**：项目自己已废弃，理由充分（黑盒不可观测）。
- **前端 48K 行 app.js 控制台**：tea 前端已有成熟 UI，只借鉴 SSE 事件协议。

## 8. 与既有决策的关系

| 决策 | 关系 |
|---|---|
| REQ-ai-project §4「不做多 agent 接力流水线（H9）」 | **不冲突**：Graph 是单请求内的确定性 workflow，不改变 AgentOrchestrator 的单专家路由语义 |
| ADR-016 Trace 四层归因 | 互补：Trace = 观测，Graph = 编排。Graph 每个 NodeOutput 天然是 Trace 的一层 |
| ADR-017 运行时领域技能 | Graph 可作为技能的执行容器（节点内调 AgentSkillRouter） |
| 前端 teaAI.ts 降级承重墙 | **不可动**：Graph 引入后 API 仍须在失败时走既有 502→规则降级路径 |

## 9. 客观批评：实测反驳（2026-10-09 第二轮）

> **方法**：在 tea 后端 classpath 上写临时探针测试（`backend/src/test/java/com/tea/graph/GraphProbeTest`、
> `GraphParallelProbeTest`），跑真实 StateGraph，读完输出即删除。graph-core 由 agent-framework 传递依赖，
> 无需改 pom。两组测试均 `BUILD SUCCESS`。**以下结论是跑出来的，不是读出来的。**

### 9.1 ❌ `experience_scorer` / `culture_scorer` 永不执行

文档原文：「`experience_scorer` 和 `culture_scorer` **始终执行**」「1 个技能评分器 + 2 个通用评分器 = **3 个节点并行**」。

实测（复刻 `deep_eval` 原样拓扑，条件边固定路由到 `java`，无 LLM）：

```
=== A: 源码原样（无 Executor）===
>> EXEC java_scorer  (#1)
>> EXEC score_aggregator  (#2)
```

**只有 2 个节点执行。**

根因：`HrRecruitmentWorkflow.java:154-158` 只写了 5 条「X → score_aggregator」的**出边**，
**从未有任何边指向 `experience_scorer` / `culture_scorer`**。无入边 = 不可达。

连锁后果（比"少跑两个节点"严重）：

| 环节 | 实际行为 |
|---|---|
| `experience_score` / `culture_score` | 永远空串 |
| `ScoreAggregatorNode.extractScore("")` | 空串 → 返回默认 `50` |
| `calculateGrade` | `avg = (skill + 50 + 50) / 3` |
| **结论** | 所谓"三维度加权评分"，**实际只由 `skill_score` 单维度决定** |

### 9.2 ❌ 不配 Executor **照样并行**

文档原文（带 ⚠️ 踩坑标记）：「**不配置 Executor 时，并行节点会被顺序调度**」「如果不配置 Executor，并行节点实际上会**串行执行**！」

实测（3 个并行节点，每个 sleep 300ms）：

```
=== A: 无 Executor（文档称会串行）===
>> EXEC b  thread=parallel-node-action-thread-2  t=1791553125589
>> EXEC a  thread=parallel-node-action-thread-1  t=1791553125589
>> EXEC c  thread=parallel-node-action-thread-3  t=1791553125589
耗时 A = 857ms

=== B: 配 ForkJoinPool ===
>> EXEC a  thread=ForkJoinPool.commonPool-worker-1
>> EXEC b  thread=ForkJoinPool.commonPool-worker-2
>> EXEC c  thread=ForkJoinPool.commonPool-worker-3
耗时 B = 623ms
```

**两者都真并发**：三个节点时间戳完全相同（…5589），分属 3 个不同线程。
框架自带默认线程池 `parallel-node-action-thread-N`。
`addParallelNodeExecutor` 是**替换**线程池（换可控的池 / 限并发），不是**开启**并行。

佐证：`addParallelNodeExecutor` 在 hr-recruitment-agent 源码中出现 **0 次**——作者自己也没配，而他的图照样跑。

> 教训：这条"铁律"我第一轮原样抄进了 AGENTS.md，是错的。**框架的"必须配"类警告，要用时间戳/线程名实测，不能信文档。**

### 9.3 ❌ 笔试门槛写死 0，与文档矛盾

`AnswerScoreNode.java:32`：

```java
private static final int PASS_THRESHOLD = 0; // 面试准入分数线
```

文档说「≥80 分进入面试」。代码是 `0` → **`passed = totalScore >= 0` 恒为 true**，`score_pass` 永远 `"pass"`，
`eval_reject` 分支是死路。注释写的"面试准入分数线"和值 `0` 自相矛盾。

### 9.4 其余客观问题清单

| # | 问题 | 证据 |
|---|---|---|
| 4 | **零测试** | `src/test` 目录**不存在**。50 个源文件、12 个端点，一个测试没有 |
| 5 | **`tools/` 三个工具是死代码** | `JdQueryTool` / `SkillMatchTool` / `HistoryQueryTool` 的 `createToolCallback()` 全项目**无调用点**，未接入任何图 |
| 6 | **`hooks/` 两个类是死代码** | `AuditLogHook` / `SensitiveInfoInterceptor` 无注册点，不生效 |
| 7 | **脱敏正则有 bug** | `SensitiveInfoInterceptor.filterResponse` 用 `replaceAll(PHONE_PATTERN, "1****$3")`，但 `1[3-9]\d{9}` **无捕获组**，`$3` 是无效组引用 |
| 8 | **评分解析极脆弱** | `ScoreAggregatorNode` 用 `Pattern.compile("(\\d+)").find()` 从 LLM 自由文本抓"第一个数字"当分数 |
| 9 | **Controller 800 行单文件** | 12 端点 + 3 内部类 DTO + 7 私有方法；HITL 续传逻辑**复制粘贴 4 遍**（`/submit-answer` `/approve` `/reject` `/replay`） |
| 10 | **SSE 手写 `new Thread()`** | Spring Boot 应用应使用 TaskExecutor；项目 Java 17，若是 21 可用虚拟线程 |
| 11 | **状态提取靠启发式** | `enrichWithStateData` 遍历所有快照取"字段最多的那个"当最终状态——猜的 |
| 12 | **文档自身矛盾** | 标题「共 20 个」vs 附录表列到 #22；#16/#18/#19/#20 四节标"需通过 vip 课程学习"= **付费墙，正文为空** |
| 13 | **9 个废弃 ReactAgent 留着** | 自称"教学对比"，对学习者是噪音 |

### 9.5 修正后的价值判断

**框架本身成立**（这部分我第一轮的判断不变，且已实证）：

- 条件边**读写分离**（节点写决策、边读决策）—— 优雅，设计正确
- HITL 三步曲 —— `javap` 核对签名真实；`course-6/TestHITL.java` 是可用模板
- Checkpoint / `getStateHistory` / 时间旅行 —— API 真实存在
- Mermaid 可视化 —— 确实能出图

**但这份教材+这个项目不是生产级样板。** 它是课程演示代码：零测试、含真 bug（10.1/10.3 是业务逻辑级错误）、
文档与代码脱节、关键章节锁付费墙。

**定位修正**：从「22 个技术点权威清单」降为「**机制参考 + 反面模式库**」。

## 10. 全课程规范代码提炼（course-1~6 + hr-recruitment-agent）

> 前两轮我只盯 `hr-recruitment-agent` 挑刺，漏了文档主体——**course-1~6 的规范代码**。
> 本节补足。所有 API 已用 `javap` 对 `agent-framework-1.1.2.4-security-fix.jar` 核对签名。

### 10.1 ReactAgent 声明式构建（course-1/2/5 全篇范式）

这是整套课程**最通用的代码形态**，`course-1/2/5` 用了几十次：

```java
ReactAgent agent = ReactAgent.builder()
        .name("writer_agent")              // 节点名 = Mermaid 节点名 = outputKey 语义
        .model(chatModel)
        .description("专业写作Agent")        // LlmRoutingAgent 靠 description 选路
        .systemPrompt("你是一个知名的作家")    // 静态人设
        .instruction("请根据用户提问回答：{input}")  // {input} 占位符自动注入
        .outputKey("article")              // 结果写入 OverAllState 的哪个 key
        .tools(toolCallback)               // FunctionToolCallback
        .saver(new MemorySaver())          // 检查点
        .hooks(hook1, hook2)               // Hook 扩展
        .build();
```

**关键机制**：`outputKey` 把 agent 输出写进 `OverAllState`，下游用 `{key}` 引用 —— **agent 之间的数据流靠状态 key 串联**，不靠参数传递。这是 tea 现有五专家（各自 `chat()` 返回 `AiChatVo`）没有的能力。

`javap` 核对的真实签名：
- `ReactAgent.builder()` → `Builder`（无参版可用）
- `AssistantMessage call(String)` / `call(Map<String,Object>)` / `call(List<Message>)`
- `StateGraph getStateGraph()` / `CompiledGraph getCompiledGraph()`
- `Node asNode(boolean, boolean)` ← **把 ReactAgent 塞进 StateGraph 当节点**（course-1 用法）

### 10.2 三种 Agent 编排器（course-5）

| 编排器 | 语义 | 代码 |
|---|---|---|
| `SequentialAgent` | 流水线：`writer → reviewer`，前者 `outputKey` 供后者 `{key}` 引用 | `SequentialAgent.builder().subAgents(List.of(a,b)).build()` |
| `ParallelAgent` | 扇出并发 + 合并 | `.subAgents(...).mergeOutputKey("risk_merged_report").mergeStrategy(new ParallelAgent.DefaultMergeStrategy())` |
| `LlmRoutingAgent` | **LLM 自动选路**：按 `description` 挑一个 subAgent | `.subAgents(...).model(chatModel)` |

`ParallelAgent` 三种合并策略（jar 实证）：`DefaultMergeStrategy` / `ConcatenationMergeStrategy` / `ListMergeStrategy`。

**`LlmRoutingAgent` 是 tea 最该关注的一个**——它和 tea 现有 `AgentOrchestrator` 做的事完全一样（按意图选专家），区别：

| 维度 | tea `AgentOrchestrator`（现状） | `LlmRoutingAgent` |
|---|---|---|
| 选路方式 | 关键词硬编码 `CULTURE_KEYWORDS` | LLM 读 `description` 语义选路 |
| 新增专家 | 改 Java 代码 + 加关键词 | 注册 subAgent + 写 description |
| 可观测 | 无 | 有 StateGraph / Mermaid |

⚠️ 但注意：它是**多 agent 编排**，REQ-ai-project §4 的 H9 红线砍的是「多 agent **接力流水线**」。
`LlmRoutingAgent` 是「选一个执行」，语义上更接近 tea 现状的**单专家路由**，不是接力。
**是否属于 H9 禁区，需你拍板**——我倾向不算，但这属于架构级判断，我不替你决定。

### 10.3 Hook 体系（course-3，最系统的扩展机制）

Hook 是「Agent 的 AOP」，四类位置（`javap` 核对 `HookPosition` 枚举）：

```
BEFORE_AGENT / AFTER_AGENT        → AgentHook
BEFORE_MODEL / AFTER_MODEL        → ModelHook 或 MessagesModelHook
```

`JumpTo` 枚举（`javap` 核对）：`tool` / `model` / `end` —— **Hook 能改变执行流向**，不只是观测。
`UpdatePolicy` 枚举：`REPLACE` / `APPEND`。

课程给的 6 个可直接抄的 Hook：

| Hook | 作用 | 关键代码 |
|---|---|---|
| `ModelCallLimiterHook` | **限制 LLM 调用次数**，超限跳 `end` | `beforeModel` 读 `config.context()` 计数；`afterModel` 递增；`canJumpTo() → List.of(JumpTo.end)` |
| `ModelCallCounterHook` | 计数统计 | 同上，不跳转 |
| `MessageTrimmingHook` | **上下文压缩**，超 N 条只留最后 N 条 | `new AgentCommand(trimmed, UpdatePolicy.REPLACE)` |
| `EarlyExitHook` | 满足条件提前退出 | `new AgentCommand(JumpTo.end, previousMessages)` |
| `ContextEnhancementHook` | 上下文增强（注入 RAG） | BEFORE_MODEL 改写 messages |
| `AuditLogHook` | 审计日志 | BEFORE/AFTER_AGENT 打时间戳 |

**`ModelCallLimiterHook` 对 tea 价值最高**：tea 有 `ai_usage_logs` 计量表但**无消费端**（REQ §2.2 缺口 G-7），
且 AiChatService 无调用次数上限。这个 Hook 是「成本硬闸门」的标准写法。

### 10.4 Interceptor 体系（course-3）

与 Hook 区别：Hook 在 **agent 生命周期**拦截，Interceptor 在**模型调用 / 工具调用**拦截。

| Interceptor | 基类 | 用途 |
|---|---|---|
| `LoggingInterceptor` | `ModelInterceptor` | 请求日志 |
| `ContentModerationInterceptor` | `ModelInterceptor` | 内容安全审核 |
| `ToolCacheInterceptor` | `ToolInterceptor` | **工具结果缓存**（`ConcurrentHashMap` + TTL） |
| `ToolMonitoringInterceptor` | `ToolInterceptor` | 工具调用监控 |

`ToolCacheInterceptor` 的 cacheKey = `toolName + ":" + arguments` —— tea 的 `CultureSearchTool`（MCP）
是**查知识库**，结果稳定，**非常适合加缓存**，直接省 token。

⚠️ 但课程版 `isExpired()` 写死 `return false`（TTL 未实现）——**抄要补实现**。

### 10.5 结构化输出（course-2）

```java
ReactAgent.builder()
    .outputType(Boolean.class)     // 或自定义 record
    .build();
AssistantMessage r = agent.call("你好");
// 容错：ObjectMapper.readValue(r.getText(), Boolean.class) + catch JsonProcessingException 回退
```

比 tea 现在 `ScoreAggregatorNode` 用正则 `(\d+)` 从自由文本抓数字**健壮得多**。
tea 的八维口感评分若要做程序化校验（REQ F-A4），应该用 `outputType` 拿结构化对象，而不是正则。

### 10.6 Skills 机制（course-4，与 ADR-017 高度相关）

```java
FileSystemSkillRegistry registry = FileSystemSkillRegistry.builder()
        .userSkillsDirectory(System.getProperty("user.home") + "/.agents/skills")
        .build();

SkillsAgentHook hook = SkillsAgentHook.builder()
        .skillRegistry(registry)
        .autoReload(true)                    // 每轮对话后自动重载
        .groupedTools(groupedTools)          // 渐进式披露：按 skill 分组挂载工具
        .build();
```

**`groupedTools` 的「渐进式披露」是核心**：工具不全部塞进 prompt，命中 skill 才挂载。
这正好解决 ADR-017 的痛点——tea 的 `AgentSkillRouter` 目前只注入**文本子指令**，
框架级的 Skills 还能**按需挂载工具**，上下文更省。

另外 `ShellToolAgentHook` 带 `withCommandTimeout(10000)` —— 有超时保护，不是裸执行。

### 10.7 各课程速查

| 课程 | 主题 | 核心可抄件 |
|---|---|---|
| course-1 | Chain / StateGraph / ReactAgent 三形态对比 | `ReactAgent.asNode(true,false)` 混编进 StateGraph |
| course-2 | ChatModel / 结构化输出 / Memory / Tools / MCP | `outputType` + 解析容错 |
| course-3 | Hooks（6 个）+ Interceptors（4 个） | 见 §10.3 / §10.4 |
| course-4 | Skills Agent + Python/浏览器/文件工具 | `SkillsAgentHook.groupedTools` |
| course-5 | Sequential / Parallel / LlmRouting | 三种编排器 |
| course-6 | Graph 进阶：Condition / CommandAction / SubGraph / HITL | `TestHITL.java`（最小可跑模板） |

## 11. 修正后的 tea 可迁移清单

| 项 | 第一轮判断 | 修正后 |
|---|---|---|
| 三维度并行评分设计 | 搬 | **不搬**，设计本身不成立（§9.1） |
| "不配 Executor 会串行" | 当铁律记入 AGENTS.md | **删除**，错的（§9.2） |
| Graph 引入可行性（零新增依赖） | ✅ | **不变**，已用 tea classpath 实跑验证 |
| HITL 三步曲 | 搬 | **搬**，但必须配"执行了哪些节点"断言测试，不能裸奔 |
| Checkpoint / 时间旅行 | 搬 | **降级 P2**：MemorySaver 重启即丢，先要有持久化方案再谈 |
| Mermaid 当验收依据 | 是 | **否**，图对不等于行为对（§5.3） |

### 11.1 第三轮新增：按 tea 缺口排序（来自 §10 规范代码）

> ⚠️ 本表是「候选迁移项」，**最终决策见 REQ-graph-introduce（F 编号）与 ADR-018**。
> 已砍项标注如下，不代表当前待办。

| 优先级 | 迁移项 | 对应 tea 缺口 | 依据 | 最终决策 |
|---|---|---|---|---|
| **P0** | `ModelCallLimiterHook` 成本闸门 | G-7 计量无消费端、无调用上限 | §10.3 | ✅ **已实现**（F-6，`AiCallQuota` + 429） |
| ~~P0~~ | ~~`outputType` 结构化输出替正则~~ | ~~F-A4 程序化校验~~ | ~~§10.5~~ | ❌ **已砍**（Q1：tea 无文本解析 LLM 输出代码，无落点） |
| ~~P1~~ | ~~`ToolCacheInterceptor` 缓存 MCP 检索~~ | ~~省 token~~ | ~~§10.4~~ | ❌ **已砍**（Q3：实测缓存命中率 0-1%，不利） |
| P1 | `MessageTrimmingHook` 上下文压缩 | 现状手工 `anchor` 截 20/5 条，可交由 Hook | §10.3 | 待议（未排期） |
| P1 | Skills `groupedTools` 渐进式披露 | ADR-017 只做文本注入，未做工具按需挂载 | §10.6 | 待议（未排期） |
| P2 | `LlmRoutingAgent` 替关键词路由 | `CULTURE_KEYWORDS` 硬编码 | §10.2 | ❌ ADR-018 判砍（架构级替换，现状无痛点） |
| P2 | `ContentModerationInterceptor` | 安全维（评测 A8 硬门槛） | §10.4 | 待议（未排期） |

### 11.2 tea 引入 Graph 的验收红线（若立 ADR-018）

> 注：ADR-018 已于 2026-10-09 落地（结论「暂缓」）。以下红线是**将来若重评通过、决定引入时**的验收门槛，非当前待办。

1. 每个节点必须有可达入边 —— 用测试断言「实际执行的节点集合」，不是看 Mermaid。
2. 并行行为用线程名/时间戳验证，不假设。
3. 阈值常量必须有测试覆盖（防 §9.3 那类 `PASS_THRESHOLD = 0`）。
4. HITL 续传必须端到端测：中断 → updateState → 带 metadata → stream(null) → 断言后续节点执行。
5. 不引入无调用点的死代码（tool/hook 有注册点才写）。
6. 抄课程 Hook/Interceptor 时补完其未实现部分（如 `ToolCacheInterceptor.isExpired` 写死 `false`）。

## 12. 结论与现状（2026-10-09 定稿）

> 本节替代原「下一步（待用户拍板）」——决策已全部落地，记录终态。

| 决策 | 终态 |
|---|---|
| Graph 编排引入 | ❌ **暂缓**（ADR-018，四维甄别 0/4） |
| 结构化输出（F-7） | ❌ 砍（Q1 无落点） |
| 工具缓存（F-8） | ❌ 砍（Q3 命中率 0-1%） |
| 成本闸门（F-6） | ✅ 已实现（`AiCallQuota` + 429 `QuotaExceededException`） |
| 评测判分真实性（F-1/F-2） | ✅ 已实现（`programOnly`/`judgeCoverage` + 口径标注） |

**遗留（阻塞项）**：T05/T06 Judge 全量与校准，被容器出网 TLS 拦截阻塞，待换网络环境或宿主直跑。

> **未核实 / 待证清单**（明确标注，不冒充已验证）：
> - 「HITL 放子图会抛 `SubGraphInterruptionException`」—— 旁证（jar 有该类 + 项目注释），**未实测**。
> - 「updateState 缺 `HUMAN_FEEDBACK_METADATA_KEY` 会从头跑」—— 项目注释自述，**未实测**。
> - 「路由表漏 key 会抛异常」—— 文档自述，**未实测**。
> - 语雀 #16/#18/#19/#20 四节正文在付费墙后，**无法核实**。
