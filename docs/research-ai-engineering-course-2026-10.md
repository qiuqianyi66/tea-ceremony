---
last_updated: 2026-10-10
status: active
owner: yanha
---

# 图灵课堂 AI 工程化课程深度学习总结（实现级）

> 学习对象：4 份资料（语雀文档 1 篇 + 直播回放 4 个）
> 学习方式：语雀正文全文精读（15309 字，22 技术点全量提取）+ 4 个视频完整下载（共约 3.3GB，合计 12498+11221+9729+10261 秒）按 2 分钟间隔抽帧 363 张取证 + 关键代码画面逐帧 OCR
> 本版定位：**实现级还原**——不只讲"有什么"，讲清"怎么实现"：每个技术点的 API 签名与调用序列、每个方案的设计文档原文、每段规范代码的完整文本。

---

## 〇、四份资料全景与逻辑关系

| # | 资料 | 讲师 | 形式 | 时长/体量 | 核心内容 |
|---|------|------|------|-----------|----------|
| 1 | 《Spring AI Alibaba Graph：HR 招聘全流程 workflow-agent 实战》 | 徐庶 | 语雀文档 | 15309 字 + 5 图 | Graph 框架 22 技术点 + HR 招聘 Agent 完整项目（代码在 gitee） |
| 2 | 《Claude Code 企业级电商项目 Harness AI 工程化编程实战》 | 诸葛 | 直播 | 208min / 941MB | Harness 五层 + 十阶段流水线 + TulingShop 电商项目 + Skill 模板 |
| 3 | 《Claude Code & Codex 企业级 Agent Skill 技能开发最佳实践》 | 诸葛 | 直播 | 187min / 711MB | 4 个实战 Skill 全流程开发（爆文/量化/小红书/Redis/排障） |
| 4 | 《从 Vibe Coding 到 AI 工程化编程开发 Openrouter AI 模型聚合平台》 | 诸葛 | 直播 | 171min / 706MB | Vibe Coding 电商实战 + Superpowers + 聚合平台计费/SSE 设计 |
| 附 | 《Java 工程化 Agent：从 Loop 到 Graph Engineering 演进思考与实战》 | 徐庶 | 直播 | 162min / 580MB | 理论前置：LLM 幻觉根源、Loop 五大缺陷、Graph 四大组件 |

**关系**：附课是理论（为什么从 Loop 进化到 Graph），语雀是实战（Graph 怎么用代码实现）；两门诸葛课（A/B/D）是另一条线（Harness + Skill + 流程治理）。两条线共用同一套工程化思想：**让 AI Agent 从"自由发挥的黑盒"变成"受约束、可观测、可审计的白盒流水线"**。

---

## 一、语雀文档：Spring AI Alibaba Graph《HR 招聘全流程 workflow-agent 实战》（实现级）

### 1.1 框架认知：Graph 为什么取代 Loop

用一句话回答"写 if-else 不行吗"：if-else 是**线性无状态**的，而招聘流程是**有状态（候选人走到哪一步了）、可中断（等候选人答题/等 HR 审批）、可分支（岗位不同走不同评分器）**的。Graph 把「做什么」（Node）与「去哪里」（Edge）解耦，核心价值是**可观测性**——这是全文反复强调的一句话：

> Graph 的核心价值 = 可观测。Mermaid 图对 ≠ 行为对，图必须能展示全部路径。

### 1.2 22 技术点实现级拆解

每个技术点给出：概念一句话 + 关键 API + 实现注意（含文档明说的坑）。

**#1 StateGraph（"画布"）**
```java
// 创建图：第一个参数是图名（命名图，Mermaid 显示用），第二个是 KeyStrategyFactory
StateGraph<OverAllState> graph = new StateGraph<>("HrGraph", strategy);
```

**#2 NodeAction：节点的三种接口**
- `NodeAction`：同步，`Map<String,Object> apply(OverAllState state)`
- `AsyncNodeAction`：异步，返回 `CompletableFuture<Map<String,Object>>`
- `AsyncNodeActionWithConfig`：带 `RunnableConfig`（HITL 节点必须用这个，因为要拿到 threadId）
- 适配器：`node_async()` 把同步节点包装成异步（项目里 17 个独立 NodeAction 全部走这个）

**#3 顺序边**：`graph.addEdge(A, B)` —— A 干完一定去 B。

**#4 条件边（核心：读写分离）**
- **节点写决策**：上游节点执行完把决策字段写进 state（如 `next_node=PASS`）
- **边读决策**：`addConditionalEdges(A, routingMap, "state.key")` 按 key 查路由表
- 项目里 6 处条件边全部是这个模式（详见 1.4 路由表）

**#5 并行边**
- 同一源节点有多条出边 = 并行；框架自动生成**隐式 ParallelNode**，等全部并行分支完成再汇聚
- 文档实测纠正：**不配 Executor 默认是串行**！要真并发必须 `addParallelNodeExecutor(...)` 换线程池
- 项目 deep_eval 子图里 frontend/java/algorithm 三评分器 + experience/culture 两通用评分器并行（见 1.5）

**#6 动态并行 `addParallelConditionalEdges`**：运行时才决定并行哪些分支。缺点（文档明说）：**并行节点的目标必须同一个**（汇聚点不能不同）。

**#7 聚合策略**：ALL_OF（等全部完成，默认）vs ANY_OF（任一完成即继续）——并行汇聚点的等待语义。

**#8 CommandAction（内嵌路由）**：节点自己返回"下一步去哪"（与条件边外置路由表对比）。项目**特意不用**——因为条件边把路由表暴露给 Mermaid，图能展示全部路径；CommandAction 的路由藏在节点内部，图上看不到。

**#9 OverAllState（共享"笔记本"）**
- 读：`state.value("key")` → 返回 OverAllValue
- 写：节点返回 `Map<String,Object>`，框架按 KeyStrategy 合并进 state
- 关键语义：**节点永远不直接改 state，只返回"更新指令"**

**#10 KeyStrategy（合并策略）**
- `Replace`：单写覆盖（用于 input/resume/next_node/score_grade/candidate_status/offer_approved 这类单写字段）
- `Append`：多写追加（用于 messages 这类多个节点都会写的字段）

**#11 编译执行 invoke vs stream**
- `invoke(config)`：要最终结果（同步）
- `stream(config)`：Flux<NodeOutput> 流式（异步，可 doOnNext 拦截）
- 项目决策：**全部用 stream()**——因为 invoke() 拿不到 InterruptionMetadata（HITL 中断信号），stream 的 doOnNext 才能检测

**#12 流式输出三种事件**：`NodeOutput`（节点输出）/ `StreamingOutput`（LLM token 流）/ `InterruptionMetadata`（HITL 中断信号）——前端 SSE 就是消费这三种事件实时渲染。

**#13 RunnableConfig**
- `threadId`：会话隔离边界（同一候选人同一 threadId，续传靠它找 checkpoint）
- `checkPointId`：时间旅行（回到历史检查点）
- `metadata`：可带自定义元数据（HITL 续传必须带 HUMAN_FEEDBACK_METADATA_KEY）

**#14 CompileConfig 静态中断**：`interruptBefore/After("nodeId")` —— 编译期就定死在哪中断。对比 #16 动态中断。

**#15 Checkpoint**：**每个节点执行后自动存快照**（数据库/内存）。时间旅行 + 断点续传都靠它。

**#16 HITL（人工介入）**
- 动态：`InterruptableAction`（实现 `interruptCondition()` 运行时判断是否中断，如"候选人没提交答案就中断"）——项目两个 HITL 节点都用这个
- 静态：`interruptBefore`（编译期定死）

**#17 断点续传 HITL 五步曲（项目最核心的代码，缺第 3 步会从头跑）**
```java
// ① 用 threadId 找到旧 checkpoint（恢复历史状态）
RunnableConfig config = RunnableConfig.builder().threadId(threadId).build();

// ② 写人工输入：updateState(旧config, 新状态, 要恢复的nodeId)
//    newState 就是候选人提交的答案 / HR 的审批意见
RunnableConfig updatedConfig =
    graph.updateState(config, newState, nodeId);

// ③【关键】标记人工反馈——不加这一步，框架不知道 resume 是人工续传，会从头跑
RunnableConfig resumeConfig = RunnableConfig.builder(updatedConfig)
    .addMetadata(HUMAN_FEEDBACK_METADATA_KEY, "human feedback")
    .build();

// ④ 从断点继续执行（用 stream 才能收到后续事件）
graph.stream(resumeConfig)...
```
**#18 时间旅行**：`graph.getStateHistory(config)` 拿全部历史 checkpoint，用 `checkPointId` 回到任意节点状态回放。

**#19 子图**：`graph.addNode("deep_eval", StateGraph/CompiledGraph)` —— 子图有**独立的 schema（KeyStrategy）**，主图只把它当一个节点。项目 deep_eval 是匿名图（L118），主图 HrGraph 是命名图（L205）。

**#20 GraphLifecycleListener**：Graph 的 AOP——监听节点开始/结束/异常，可用于耗时统计、日志埋点。

**#21 Mermaid 可视化**：`buildWorkflow()` 最后一步（L333）启动时打印整张流程图。

**#22 长期记忆**：`Store = LocalStorage`（跨会话持久化用户偏好）；`OverAllState = SessionStorage`（单会话状态）。两层记忆分离。

### 1.3 HR 项目全貌（代码位置：gitee.com/xscodeit/spring-ai-alibaba-xs/tree/main/hr-recruitment-agent）

**类构成**（HrRecruitmentWorkflow.java）：
- 主图 `HrGraph`（L205，命名图）
- 子图 `deep_eval`（L118，匿名图）
- 17 个独立 NodeAction（hr/nodes/ 下，node_async() 包装）
- 2 个 HITL 节点：`CandidateSubmitHitlNode`（L357）、`OfferApprovalHitlNode`（L391）——均为 `AsyncNodeActionWithConfig + InterruptableAction`
- 2 个 Lambda 匿名节点：`eval_reject`（L221）、`background_decision`（L236）
- 9 个**废弃的 ReactAgent 版本**（详见 1.6 工程决策）

**主图状态字段表**（Replace/Append 设计，语雀原文）：

| 字段 | 策略 | 说明 |
|------|------|------|
| input | Replace | 候选人原始简历输入 |
| resume | Replace | 解析后的结构化简历 |
| next_node | Replace | 初筛决策（PASS/REJECT），条件边 1 读 |
| score_grade | Replace | 笔试等级（A/B/C），决定面试题难度 |
| candidate_status | Replace | 候选人作答状态（submitted/timeout），条件边 3 读 |
| offer_approved | Replace | HR 审批结果（approve/reject_offer），条件边 5 读 |
| messages | Append | 多节点追加的消息历史 |

### 1.4 主图完整流程（Mermaid SVG 逐节点解析）

```
START
 → parse_resume(简历解析)
 → screen_resume(初步筛选)
 → condition1(check state) ──PASS 通过──▶ deep_eval(深度评估子图)
                         └─REJECT 拒绝─▶ reject
 → candidate_submit(笔试作答[HITL])        ← 子图出来后
 → condition2 ──submitted 已提交──▶ answer_score(笔试评分)
             └─timeout 超时───────▶ reject
 → answer_score
 → condition3 ──pass 通过──▶ hr_interview(HR面试第1轮) → tech_interview(技术面试第2轮)
             └─fail 不通过─▶ eval_reject → reject
 → final_interview(终面第3轮) → background_decision(背景调查决策)
 → condition4 ──pass 通过──▶ offer_gen(生成Offer) → offer_approval(Offer审批[HITL])
             └─fail 不通过─▶ reject
 → condition5 ──approve 批准────▶ send_offer(发送Offer) → END
             └─reject_offer 拒绝─▶ reject → END
```

### 1.5 子图 deep_eval 内部（3 路并行，不是 5 个全跑）

```
子图 START
 → startcondition(岗位路由 check state)
 → frontend_scorer | java_scorer | algorithm_scorer   ← 三选一（frontend/java/algorithm）
 → score_aggregator(评分汇总)  ← 同时恒入 experience_scorer + culture_scorer
                                  （实际 3 路并行 = 1 个技能评分器 + 2 个通用评分器）
 → gen_questions(生成面试题) → send_questions(发送面试题) → 子图 stop
```
注意点：experience_scorer / culture_scorer **没有入边也"恒入"** score_aggregator——这是语雀实测纠正过的坑：**无入边的节点不执行**（图能编译、Mermaid 好看，但节点不跑），这两个评分器是直接连到汇聚点的常驻并行分支。

### 1.6 三个关键工程决策（规范实践）

1. **为什么弃 ReactAgent 当节点**：项目早期有 9 个 ReactAgent 版本。ReactAgent 是**黑盒**——Mermaid 里只显示 1 个节点，中间思考不可观测。拆成 NodeAction 后，每一步都是图上的一个节点，可监控、可中断、可恢复。**Graph 核心价值 = 可观测性**。
2. **为什么全部用 stream()**：要检测 HITL 中断必须消费 InterruptionMetadata 事件，invoke() 拿不到。
3. **为什么用条件边而不是 CommandAction**：条件边路由表在图上可见（Mermaid 展示全部路径），CommandAction 路由藏在节点内部不可见。

### 1.7 三种 SSE 消费模式（Controller 层）

| 端点 | 模式 | 实现 |
|------|------|------|
| POST /start | 同步阻塞 | `graph.stream(config).blockLast()` 等全部完成 |
| POST /start/stream | 流式 JSON | Flux 流式返回 NodeOutput 序列 |
| POST /start/sse | 实时推送 | `SseEmitter`，每个 NodeOutput 事件实时推给前端（15 节点全 Node 可视化监控页 + 实时执行日志） |

前端监控页（语雀图 1）：15 节点全 Node 可视化，已完成节点绿色、进行中高亮、待处理灰色；下方实时 SSE 日志显示当前节点与 Thread ID。HITL 交互页（语雀图 2）：candidate_submit 节点中断时，弹窗展示 AI 按 C 级候选人定制的结构化面试题（技术深度/项目经验/文化适配三类），候选人提交答案或超时放弃。

---

## 二、回放 A：《Claude Code 企业级电商项目 Harness AI 工程化编程实战》（诸葛，208min）

### 2.1 Harness 工程化认知

> **公式：Agent = Model + Harness**
> Model 是商品（同质化），Harness 是团队竞争力。公开佐证：LangChain 只改 harness 不加模型能力，Terminal Bench 2.0 从 52.8% → 66.5%（+13.7）；OpenAI Codex 团队 5 个月用 AI 产出约 100 万行生产代码、零手写。

**约束悖论**（视频强调）：给 Agent 更多自由反而更不可靠——Claude 最高 reasoning budget 档跑分 53.9%，低于 high 档 63.6%。**约束 > 能力**。

**Harness 五层**：

| 层 | 回答的问题 | Claude Code 落点 |
|----|-----------|------------------|
| 1. Memory | Agent 知道什么 | CLAUDE.md（静态规则，失败日志式） |
| 2. Tools | Agent 能访问什么 | settings.json 配置 MCP |
| 3. Permissions | Agent 被允许做什么 | settings.json allow/deny（最小权限） |
| 4. Hooks | 运行时强制什么 | PreToolUse exit 2（无条件拦截越权工具调用） |
| 5. Observability | 事后能看到什么 | Session logs、成本追踪 |

### 2.2 项目结构（TulingShop，视频实测）

```
TULINGSHOP/
├── claude/
│   ├── CLAUDE.md              # 项目规则（Memory 层）
│   ├── agents/                # code-reviewer.md / consistency-verifier.md / red-line-auditor.md
│   └── settings.json          # 权限/MCP（Permissions/Tools 层）
├── harness/
│   ├── changes/               # 特性变更追踪：product-review/search/shopping-cart/user/user-level/user-points-feature
│   ├── rules/                 # 工程结构.md、开发流程规范.md、编码规范.md
│   ├── skills/                # main-dev-skill(6) + biz-dev-skill(13) + trouble-shooting-skill(5)
│   └── wiki/                  # 业务模型/接口协议/数据模型/领域术语
├── tulingshop-backend/        # Spring Boot 3.x + MyBatis-Plus + MySQL 8.7 + Redis 7.x + RocketMQ 5.x
├── tulingshop-frontend/       # Vue 3 + TypeScript + Pinia + Vite + Element Plus
├── AGENTS.md / docker-compose.yml
```

### 2.3 十阶段流水线 + Quality Gate

```
需求 → 方案 → 拆分 → 编码 → 单测 → 评审 → 集成 → 预发 → 部署 → 观测
  │      │      │      │      │      │      │      │      │      │
  ├─ request-analysis ×3   编码   unit-test-write  expert-review  deploy-verify ×4
  └─ F编号+Given-When-Then        覆盖率≥80%     +unit-test-ci    预发→生产→回滚
      +边界+影响分析               核心逻辑100%   红线零违反
```
- 分支规范：`feature/{feat-name}` 与 `harness/changes/{feat-name}` **同名**（分支与变更追踪一一对应）
- commit type：feat/fix/refactor/test/docs/chore（conventional commits）
- 每阶段 Quality Gate 不满足禁止进入下一阶段

### 2.4 CLAUDE.md 红线全文（视频帧 OCR 原文，8 条）

```markdown
# 固定红线 AI 编码约束
## 技术栈
- 前端：Vue 3 + TypeScript + Pinia + Vite + Element Plus
- 后端：Spring Boot 3.x + MyBatis-Plus + MySQL 8.7 + Redis 7.x + RocketMQ 5.x

## 红线（不可违反）
1. 价格字段必须使用 Integer（分为单位）→ 禁止 float/double/BigDecimal 表示金额
2. 禁止直接返回 Error 类异常 → 禁止裸 RuntimeException 流到 API 层
3. Redis Key 前缀必须为 turingshop: → 禁止无名或通用前缀
4. RocketMQ 消费者必须重试 → 每个消息都必须设置重试消费策略
5. Controller 必须使用构造器注入 → 禁止 @Autowired 字段注入
6. Service 必须声明 @Transactional(rollbackFor = Exception.class) → 禁止异常时不回滚
7. response 必须使用 Result 统一格式 → {code, message, data} 结构
8. Vue 3 必须使用组合式 API → 禁止 Options API、禁止 console/debug
```

### 2.5 编码规范.md 实现级代码（视频帧 OCR，非常规范）

**异常处理**（BusinessException 体系）：
```java
// 异常类型对齐（均为真实业务异常）
// 资源不存在        → NotFoundException
// 参数/业务规则不合法 → ValidationException
// 认证/权限失败      → AuthException
// 其他业务异常兜底   → BusinessException

// ✅ correct — 具体业务异常，可带占位参数
throw new NotFoundException("订单不存在");

// ❌ wrong
throw new RuntimeException("Order not found");

// 全局处理器 GlobalExceptionHandler（@RestControllerAdvice）统一捕获：
// - BusinessException → 按 getCode()/getStatus() 返回，日志级别 warn
// - 非业务异常 → 统一包装返回，日志级别 error
// 业务代码只管抛异常，不自己 try-catch；禁止 catch 空处理、禁止 printStackTrace
```

**Controller 规范**（构造器注入）：
```java
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;   // final 字段 = 构造器注入

    @PostMapping
    public ApiResponse<OrderVO> create(@RequestBody OrderCreateDTO dto) {
        return ApiResponse.ok(orderService.createOrder(dto));
    }
}
```

**Service 规范**：
```java
// 写操作：必须声明 rollbackFor
@Transactional(rollbackFor = Exception.class)
public OrderVO createOrder(OrderCreateDTO dto) {
    // 参数校验：用 getUserId() 获取用户ID（AuthenticationFilter 写入 ThreadLocal）
    // 禁止从请求参数强转 userID
    Long userId = UserContext.getUserId();
    ...
    return buildOrderVO(order);   // entity->vo 转换用私有方法 buildXxxVO()
}

// 只读操作
@Transactional(readOnly = true)
public OrderVO getOrder(Long id) { ... }
```

**常量与枚举**：
```java
// 模块常量：common/constant/module/OrderConstant
public final class OrderConstant {
    private OrderConstant() {}                       // 禁止实例化
    public static final int ORDER_CANCEL_MINUTES = 15;
    public static final String ORDER_NO_PREFIX = "ORD";
}
// 状态超过 2 个语义 → 枚举（OrderStatus、PayChannel、PaymentStatus），禁止硬 int 状态比较
```

**日志规范**（@Slf4j + 占位符，禁止字符串拼接）：
```java
@Slf4j
@Service
public class OrderService {
    log.info("消费订单创建消息-扣减库存，orderId:{}", message.getOrderId());  // ✅
    log.info("消费订单创建消息: " + message.getOrderId());                   // ❌
}
```

### 2.6 工程结构.md（后端目录，视频帧原文）

```
tulingshop-backend/src/main/java/com/tulingshop/
├── config        # 配置类
├── controller    # 13 个 Controller 平铺，按模块类名前缀区分
├── dto           # 请求参数封装
├── mapper        # MyBatis 接口（13 个 Mapper 平铺）
├── repository    # 仓储层
├── entity        # 数据库实体（表一一对应）
├── input         # 请求消息（OrderCreatedMessage 等）
├── po            # 数据库持久层对象
├── producer      # MQ 生产者
├── consumer      # MQ 消费者
├── task          # 定时任务（OrderCancelTask 等）
├── context       # 上下文（UserContext、CartContext）
├── holder        # 请求上下文（UserContext - ThreadLocal 用户ID）
├── enums         # 枚举（OrderStatus、PayChannel、PaymentStatus）
├── exception     # 异常体系 + GlobalExceptionHandler
└── utils         # 工具类（AssertUtil、PageUtil、DateTimeUtil）
src/main/resources/
├── application.yml        # 主配置（含 profile 激活）
├── application-dev.yml    # dev/test/prod 各一份
└── mapper/                # MyBatis XML（ProductMapper.xml）
src/test/java/com/tulingshop/
├── controller/  # 测试目录（包路径与 main 镜像）
└── service/     # MockMvcTest
sql/
├── init.sql            # 数据库脚本
└── v2_xx.sql           # 增量迁移（v2_add_payment_table.sql）
```

### 2.7 Skill 体系与完整模板（三族，视频逐帧）

```
harness/skills/
├── main-dev-skill/            # 主开发流程（6 个）
│   ├── request-analysis       # 需求分析
│   ├── coding-skill           # 编码实现
│   ├── unit-test-write / unit-test-ci
│   ├── expert-reviewer        # 专家评审
│   └── deploy-verify          # 部署验证
├── biz-dev-skill/             # 业务开发模板（13 个）
│   ├── 01-crud-scaffold / 02-pagination-query / 03-redis-cache
│   ├── 04-mq-messaging / 05-transaction-consistency / 06-exception-handling
│   ├── 07-business-validation / 08-excel-import-export / 09-db-migration
│   └── 10-scheduled-task / 11-file-upload / 12-notification / 13-stats-report
└── trouble-shooting-skill/    # 线上故障排查（5 个）
    ├── 01-slow-sql / 02-oom-troubleshoot / 03-cpu-high-troubleshoot
    └── 04-mq-backlog-troubleshoot / 05-redis-hotkey-troubleshoot
```

**08-excel-import-export SKILL.md 完整模板**（视频帧 OCR 原文，Skill 写法范本）：

```markdown
---
name: excel-import-export
description: Excel导入导出，基于 EasyExcel 的批量导入导出实现，含分批处理、
  导入校验与失败行精确反馈。后台管理需要批量导入商品/用户/字典数据、订单导出/
  财务报表，或用户数据迁移时使用本技能。
---
## 概述
实现 Excel 批量导入导出，核心思路：
- **EasyExcel 替代 POI**（避免 OOM）
- **分批次处理**（避免内存爆掉）
- **导入校验**（失败行精确反馈）

## 触发条件
- 后台管理需要批量导入商品/用户/字典数据
- 订单/商品/财务报表导出
- 用户数据迁移

## 前置条件
- 引入 EasyExcel：com.alibaba:easyexcel:3.3.4
- 数据库已创建
- 文件存储服务（OSS/MinIO/本地）可访问

## 核心流程
#### Step 1: 实体定义（EasyExcel 注解）
```java
@Data
public class ProductImportVO {
    @ExcelProperty("商品名称")
    private String name;

    @ExcelProperty("商品价格（元）")
    private BigDecimal price;   // 导入元，存库转分

    @ExcelProperty("商品分类")
    private String category;

    @ExcelProperty("库存数量")
    private Integer stock;

    @ExcelIgnore                    // 不读取，该字段只做存储
    private String remark;
}
```
#### Step 2: 批量读取（分批 + 监听器）
```java
EasyExcel.read(inputStream, ProductImportVO.class, new PageReadListener<ProductImportVO>(
    dataList -> {
        // 每批 100 条：校验 + 落库
        for (ProductImportVO row : dataList) {
            validate(row);          // 校验失败收集行号
            save(row);
        }
    }, 100)).sheet().doRead();
```
```

**02-oom-troubleshoot SKILL.md**（trouble-shooting 族写法）：
```markdown
---
name: oom-trouble
description: OOM 内存溢出排查：JVM OOM 事故标准化排查流程，含 dump 获取、大对象
  与 GC Roots 分析。当应用出现 OutOfMemoryError、JVM 频繁 Full GC、服务无响应
  或容器被 OOM Killer 杀掉时使用本技能。
---
## 核心原则
JVM 事故的标准化排查流程。核心是：**拿到 dump → 看大对象 → 看 GC Roots → 看代码哪里在不断新建对象**。

## 触发条件
- 应用抛出 OutOfMemoryError
- JVM 频繁 Full GC
- 服务无响应、卡顿，有大量 GC 线程
- 容器被 oom killer 杀掉

## 前置条件
- 应用启动时开启 -XX:+HeapDumpOnOutOfMemoryError
- jmap / jstat / jstack 命令可用
- MAT 或 VisualVM 分析工具

## 核心流程
### Step 1: 保留现场（第一时间）
ps -ef | grep java                                   # 拿进程 PID
jmap -dump:format=b,file=/tmp/heap.hprof <pid>       # 紧急 dump heap
jstack <pid> > /tmp/jstack_dump.txt                  # 看线程栈，定位死锁/死循环
jstat -gc <pid>                                      # 看 GC 内存状况
```

**coding-skill 的"上下文准备"段**（token 红线落地）：
```markdown
## 上下线准备
被谁加载：规则 + Wiki 合计不超过 4 个
- harness/rule/编码规范.md     必读
- harness/rule/工程结构.md     涉及新增包/模块时
- harness/rule/接口设计.md     涉及新增 API 时
- harness/rule/接口协议.md     涉及 API 设计时
- 调试模式参照 harness/rule/debug.md（mq/分库/Redis缓存/事务一致性/异步/业务校验）
  本次只约定检查点，不重复展开模式细节
## 代码结构参照
代码必须落在真实包结构中，禁止自行发明路径：
tulingshop-backend/src/main/java/com/tulingshop/{controller,service,repository,model,mapper,producer,consumer,task,config,exception,util}
tulingshop-frontend/src/{api,assets,components,pages,router,store,styles,utils}
```

**Skill 统一范式**（从多个 SKILL.md 归纳）：`frontmatter(name+description) → 触发条件 → 前置条件 → 上下文准备(规则+wiki≤4) → 执行流程(Step 1..N) → 代码模板 → 红线规则`。**技能只定义流程与检查点，不重复展开模式细节**；description 写清"何时触发"，由 Agent 按需渐进加载，不塞进系统提示。

### 2.8 实战演示：商品比价功能（Claude Code 交互式关键决策）

视频后半段完整演示一个需求的落地。进入编码前 Claude Code 用 AskUserQuestion 让用户确认**关键决策**：
```
项目结构已经理清了，在方案落地前有几个关键决策需要你确认：
Q: 比价的价格数据从哪里来？
  A. 站内多源价格（推荐）
  B. 对接第三方比价 API
  C. 对接外部比价 API
```
这正是"需求分析 → 方案"阶段的交互式 Quality Gate——AI 不猜关键决策，显式问人。

---

## 三、回放 B：《Claude Code & Codex 企业级 Agent Skill 技能开发最佳实践》（诸葛，187min）

### 3.1 课程 11 项

1. Codex & Claude Code 安装与后端大模型 API 配置
2. Codex 快速开发公众号爆文自动生成 Skill
3. OpenClaw 官方 ClawHub 与腾讯 SkillHub 技能库分析
4. Codex & Claude Code 技能快速安装与使用实操
5. AkShare 大 A 量化交易 Skill 核心功能剖析
6. skill-creator 元技能：Skill 开发最佳实践
7. Codex 开发小红书图文自动发布 Skill
8. Claude Code 开发企业级 Redis 缓存架构 Skill
9. Claude Code 开发企业级线上问题排查 Skill
10. Agent Skill 企业级 AI 工程化落地案例
11. 程序员在 AI 爆发时代如何缓解技术迭代焦虑

### 3.2 Skill 的存储与组织（视频实测）

- **Codex 技能目录**：`C:\Users\<user>\.codex\skills`，含 `.system/`（系统技能）、`@user_xxx/`（用户技能）、`akshare-stock-cn/`（第三方技能）、`skills_store.lock.json`（技能仓库锁）
- **Skill 本质**：带 frontmatter（name/description）+ 结构化正文（触发条件/前置准备/核心规则/执行流程）的 Markdown 模板 + 可选 scripts/ 可执行脚本。让 Agent 在特定任务时**按需加载特定技能**，而不是把全部上下文塞进系统提示。

### 3.3 四个实战 Skill 解剖

**① 公众号爆文 Skill（TECH-ARTICLE-WRITER）**：`style-guide.md`（写作风格样本）+ `SKILL.md`。演示 prompt："请按照周老师的写作风格写一篇 Codex 使用入门的文章"，Skill 自动匹配风格：熟悉风格结构（开篇 hook → 首段引文 → 过渡语 → 中文数字章节 → CTA → 口语化标题）。演示中还展示了 Claude Code 识别环境限制（网络/权限）自动降级用命令行方式。

**② AkShare 量化交易 Skill**（CLI 化封装，可执行 Skill 的标准范式）：
```markdown
## 环境准备
pip install akshare

## 使用方式
所有查询通过 CLI 脚本完成，SKILL_DIR 为该 SKILL.md 所在目录
python3 $SKILL_DIR/scripts/akshare_cli.py <子命令> <参数>
默认输出 json，加 --format table 输出表格

## 实时行情
python3 $SKILL_DIR/scripts/akshare_cli.py spot                    # 全市场实时行情
python3 $SKILL_DIR/scripts/akshare_cli.py spot --board 北交所      # 指定板块

## 历史线
python3 $SKILL_DIR/scripts/akshare_cli.py kline 000001            # 日线（默认近一年，前复权）
python3 $SKILL_DIR/scripts/akshare_cli.py kline 000001 --period weekly --start 20240101 --end 20241231

## 财务数据
python3 $SKILL_DIR/scripts/akshare_cli.py finance 000001          # 财务报表
```
（脚本内置重连机制、错误处理、JSON/表格双格式输出）

**③ 小红书图文自动发布 Skill（xiaohongshu-publisher v2.1，node.js + playwright）**：
```markdown
name: xiaohongshu-publisher
description: 小红书图文笔记自动发布工具（node.js + playwright）。当用户需要发布
  小红书图文、扫码登录、批量发布笔记、或需要设定自动化发布内容时触发此 skill。
  支持接入小红书 AI 专属写作风格 + 自动发布（可配置）。

## 工作流程
用户输入(主题/关键词/草稿)
→ AI 按风格改写(标题+正文+标签)
→ 预览确认(可修改)
→ Playwright 浏览器自动发布

## 小红书专属写作风格（风格参考 references/style.json）
### 标题风格
- 12 字以内，语气亲切，带 emoji 😊✨🔥
- 短标题、领域词 + 长尾词 + 热门词；不要复制原题用词
- 例："用了 Code 后，我回不去了"
### 正文风格
- 开头：痛点/场景引入("之前一直在...")
- 中间：emoji 数字分段(1. 2. 3.)，每段 2-3 句
- 结尾：注意事项、建议、话题标签
- 标签：#小红书运营 #干货分享 #程序员日常 #评论区聊聊
### 结构
痛点引入 → 解决方案 → 效果 → 总结
```
（目录：XIAOHONGSHU_PUBLISHER/{node_modules,references/style.json,scripts,package.json,SKILL.md}）

**④ Redis 缓存架构 Skill（Cache Aside 标准模板，视频帧完整代码）**：
```java
// Step 2 - Cache Aside 标准模板
public XXXVO xxxDetail(Long id) {
    // 1. 查缓存
    XXXVO cached = getCache(id);
    if (cached != null) {
        return cached;
    }
    // 2. 缓存未命中 → 查库
    XXXVO vo = xxxMapper.selectById(id);
    if (vo == null) {
        throw new BizException("xxx不存在");
    }
    // 3. entity → VO，写缓存，返回
    XXXVO result = xxxConvert.toDto(vo);
    cacheData(id, result);
    return result;
}

@SuppressWarnings("unchecked")
private XXXVO getCache(Long id) {
    try {
        Object cached = redisTemplate.opsForValue().get(CACHE_PREFIX + id);
        if (cached != null) {
            return (XXXVO) cached;
        }
    } catch (Exception e) {
        log.warn("Failed to get cache for key:[{}]", CACHE_PREFIX + id, e);
    }
    return null;   // 兜底降级：查不到就当缓存不存在（Redis 挂了不影响业务）
}

private void cacheData(Long id, XXXVO vo) {
    try {
        redisTemplate.opsForValue().set(CACHE_PREFIX + id, vo, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
    } catch (Exception e) {
        log.warn("Failed to cache data for key:[{}]", CACHE_PREFIX + id, e);
    }
}
```
Skill 里的缓存策略表：读多写少→Cache-Aside(TTL 10-30min)；热点数据→启动预热+定时刷新；实时性高→不缓存或≤1min；用户私有→按 userId 分区(30min)；计数器/库存→Redis 原子操作。

**⑤ 慢 SQL 排查 Skill（trouble-shooting 族，EXPLAIN 四字段）**：
```markdown
## 概述
系统化排查慢 SQL 的流程，核心是 **EXPLAIN 必看 type 和 Extra**、**覆盖索引避免回表**、**慢 SQL 日志是金矿**。

## 触发条件
接口响应 > 1 秒 / 慢 SQL 日志告警 / 数据库 CPU 打满 / 报表查询超时

## 前置条件
MySQL 慢查询日志已开启：slow_query_log=1; long_query_time=1

## 核心流程
### Step 1: 定位慢 SQL（三个入口）
# 入口1: 慢查询日志（最直接）
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1
mysqldumpslow -t 100 /var/log/mysql/slow.log
# 入口2: Performance Schema（实时）
SELECT * FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 10;
# 入口3: 业务日志（最具体）
在 SQL 拦截器里打印: traceId + SQL + 耗时 + 行数
### Step 2: EXPLAIN 分析（必看 4 个字段）
EXPLAIN SELECT * FROM order_info WHERE id = 1;
-- type（访问类型：ALL 全表扫描必优化）
-- key（实际用到的索引）
-- rows（扫描行数）
-- Extra（Using filesort / Using temporary 都是危险信号）
```

### 3.4 Skill 开发范式总结（两门课交叉验证）

`name + description(何时用) → 触发条件 → 前置条件 → 核心规则/红线 → 执行流程(Step N) → 代码模板 → 降级/兜底`。关键原则：
1. **description 决定触发**：写清"用户说 xx 时使用本技能"
2. **技能自带兜底**：Redis 挂了返回 null 不炸、导入失败行精确反馈
3. **可执行技能带 scripts/**：CLI 化封装，SKILL_DIR 相对定位
4. **风格类技能带 references/**：style.json 等风格样本外置

---

## 四、回放 C：《Java 工程化 Agent：从 Loop 到 Graph Engineering》（徐庶，162min，理论前置）

### 4.1 大模型幻觉根源（视频用自建 HTML 可视化演示）

视频现场演示了一个 **LLM 预训练过程可视化网页**（"苹果是红的，模型预测：苹果是__"），讲清幻觉机理：
1. 喂入训练数据：互联网语料一句话，初始权重随机
2. 前向传播（预测）：初始预测离谱错误
3. 计算误差 Loss：对比预测与 Ground Truth，产生巨大误差信号
4. 反向传播（更新权重）：误差从右向左流过网络，强化/弱化连接——"知识嵌入权重的瞬间"

核心结论：**LLM 是统计模型不是知识库**——预测下一个词的概率分布，知识是权重里的统计相关性。因此：会产生幻觉（概率采样）、无法精确计算、上下文越长越容易跑偏——这就是 Agent 需要工程化约束（Harness/Graph）的根本原因。

### 4.2 Loop 迭代架构的五大结构性缺陷

```
Loop 迭代架构（ReAct 式 while 循环）
while(todo) {
    think()     → 推理
    act()       → 调工具
    observe()   → 观察结果
}
```
1. **状态不可观测**：循环内部在想什么、干到哪一步，外部看不见（黑盒）
2. **中断后无法续传**：会话一断就从头跑，没有 checkpoint
3. **无结构化分支**：if-else 表达不了"按候选人等级走不同流程"这种业务分支
4. **无并行能力**：5 个评分器只能串行
5. **自检不可靠**：让模型自己判断"我错了没"本质上还是同一个模型在猜

### 4.3 AI 应用工程五层演进 + AgentScope Harness 生产防护体系

视频提出 AI 应用工程化分层（演进视角）：从直接调 API → Prompt 工程 → RAG → Agent → 多 Agent 编排。生产防护体系（AgentScope）强调：**Agent 上线必须带护栏**——输入校验、工具权限、超时熔断、成本控制、审计日志——与诸葛老师的 Harness 五层完全同构。

### 4.4 复刻 Claude Code 迭代揭露 Loop 自检缺陷

现场演示用 AgentScope 复刻 Claude Code 的迭代循环，暴露 Loop 自检的不可靠（模型对"是否完成/是否正确"的判断反复横跳）——这是 Graph 用**结构化条件边 + 确定性状态检查**替代模型自检的动机：**路由决策让边读确定性 state 字段，不靠模型猜**。

### 4.5 Spring AI Alibaba Graph 四大核心 Workflow 组件（衔接语雀实战）

StateGraph（状态图）+ NodeAction（节点动作）+ ConditionalEdge（条件边）+ InterruptableAction（可中断动作）——语雀文档的 22 技术点全部围绕这四组件展开。

### 4.6 多 Agent 并行分析（视频实测画面）

现场演示 Claude Code 的 **Analyze 模式 5 agents 并行**：security / structure / build / tests / performance 五个分析维度并行跑，底层模型 deepseek-v4-pro-260425。这就是"多 Agent 并行开发"的实操形态。

---

## 五、回放 D：《从 Vibe Coding 到 AI 工程化编程开发 Openrouter 平台》（诸葛，171min）

### 5.1 课程 11 项

1. Codex & Claude Code 快速安装与后端大模型 API 配置
2. Codex 从零开始 Vibe Coding 电商项目实战
3. Claude Code 从零开始 Vibe Coding 电商项目实战
4. Agent Skill AI 工程化工作流框架 Superpowers 详解
5. Claude Code 插件式整合 Superpowers
6. Openrouter 全球最大 AI 模型聚合平台核心功能介绍
7. Claude Code AI 工程化开发 Openrouter 模型聚合平台
8. Superpowers 多 Agent 并行开发 Openrouter 核心功能
9. 企业级项目从需求到上线 Superpowers 核心 Skill 源码剖析
10. 阿里巴巴内部大型项目 Harness AI 工程化最佳实践
11. AI 爆发时代程序员如何学习

### 5.2 Vibe Coding 电商实战（Codex/Claude Code 双线）

起点 prompt（视频实测）：
```
请帮我开发一个电商网站，需要包含用户、商品、购物车、订单相关，不需要任何本地启动的配置。
```
项目 cc-shop-super（D:\AICoding\cc-shop-super）。生成的购物车代码（writeCart.js，Node.js + Express + MySQL，非常规范）：
```javascript
import { Router } from 'express'
import { auth } from '../auth'
import { mysql } from '../db'
const router = Router()

// 获取购物车
router.get('/', auth, async (req, res) => {
  const userId = req.id
  const [rows] = await mysql.query(`
    SELECT cart_items.id, cart_items.quantity,
           products.p_id, products.p_name, p_shop, p_image_url
    FROM cart_items
    JOIN products p ON p.p_id = cart_items.product_id
    WHERE cart_items.user_id = ?
    ORDER BY ci.created_at ASC
  `, [userId])
  res.json(rows)
})

// 加入购物车（已存在则累加数量）
router.post('/', auth, async (req, res) => {
  const { productId, quantity = 1 } = req.body || {}
  if (!productId) return res.status(400).json({ error: '缺少商品ID' })
  const qty = Math.max(1, Number(quantity) || 1)         // 参数兜底

  // 检查商品是否存在
  const [product] = await mysql.query(`SELECT id FROM products WHERE id = ?`, [productId])
  if (!product.length) return res.status(404).json({ error: '商品不存在' })

  // 检查购物车是否已有该商品
  const [existing] = await mysql.query(
    `SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?`,
    [userId, productId])
  if (existing.length) {
    await mysql.query(`UPDATE cart_items SET quantity = quantity + ? WHERE id = ?`,
      [qty, existing[0].id])
    return res.json({ success: true, message: '已更新购物车数量' })
  }
  // 新增购物车项
  await mysql.query(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)`,
    [userId, productId, qty])
  res.json({ success: true, message: '已加入购物车' })
})
export default router
```
运行环境（视频实测）：前后端 concurrently 同跑，后端 API :4000、前端 :5173，演示账号 admin/123456，SQL 文件重置测试环境（10 商品 + demo 账号），Vite proxy 转发免跨域。

### 5.3 Superpowers 工作流框架

**Superpowers** = 一个 Agent Skill AI 工程化工作流框架（插件式），把项目开发拆成标准流程：
- Task 列表（task-1-brief.md、task-2-brief.md…）+ 评审循环 + ledger 记账
- 多 Agent 机制：task-notification（任务通知）/ task-id（任务标识）/ tool-use-call（工具调用审批）/ re-review（复审）
- 流程：Task 1 approved → ledger（记账）→ Task 2 开始

### 5.4 Openrouter 平台与 LLM Leaderboard

**OpenRouter**：全球最大 AI 模型聚合平台——一个 OpenAI 兼容 API 接入 500+ 模型、80+ provider，自动 fallback、负载均衡、限流。核心：统一 API（一个 Key 调所有模型）、Model Fusion（多模型并行路由）、LLM Leaderboard（token 用量/份额/速度排行）、Agent SDK。

视频实测排行榜数据（2026-07）：

| 模型 | Provider | 周 token 用量 | 环比 |
|------|----------|--------------|------|
| Hy3 | tencent | 8.98T | ↑373% |
| MiMo-V2.5 | xiaomi | 8.03T | ↑79% |
| DeepSeek V4 Flash | deepseek | 5.22T | ↓4% |
| MiniMax M3 | minimax | 4.04T | ↓6% |
| GLM5.2 | z-ai | 3.29T | ↑8% |
| Nemotron 3 Ultra | nvidia | 3.06T | ↑226% |
| DeepSeek V4 Pro | deepseek | 2.54T | ↓8% |
| Claude Opus 4.8 | anthropic | 2.2T | ↑8% |
| Claude Opus 4.7 | anthropic | 2.05T | ↓21% |
| Step 3.7 Flash | stepfun | 946B | - |

### 5.5 自建聚合平台工程方案（CC-Shop AI 大模型聚合平台设计文档，视频帧原文）

**计费流程** `/v1/chat/completions`（OpenAI 兼容）：
```
1. 解析 Header 里的 api-key → hashedKey 查用户账户
2. 校验 model 存在且 active；余额不足直接拒绝
3. 扣预付款（按预估 prompt token 扣；扣完重算）
   completionPrice = completionToken × completionPrice / completionTokens
4. 调用 provider，拿到回复 + completion token 计数
   实际成本 = promptTokens × promptPrice/1k + completionTokens × completionPrice/1k
5. 补扣尾款（按实际用量多退少补），写 Usage + RequestLog
6. 返回 OpenAI 兼容 JSON / SSE 流
```

**流式（SSE）处理**：
```
Mock provider 逐 token 产出 data: {...}\n\n，最终 data: [DONE]
计费在流结束后累计 token 一次性结算（流中不结算，避免重复扣费）
鉴权失败/余额不足/模型不存在 → OpenAI 风格错误 { error: { message, type, code } }
```

**本地开发代理**（vite.config.js）：
```javascript
export default {
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8888' },
      '/v1':  { target: 'http://localhost:8888' },   // OpenAI 兼容端点
    }
  }
}
```

**前端页面**：登录/注册 → 模型目录（卡片网格，搜索 + provider 筛选，显示定价/上下文窗口）→ 模型详情（定价、Context、Playground 在线试玩）。

**后端任务拆分**（多 Agent 并行开发的任务流，视频帧原文 Task 3-13）：
```
Task 3: 实体及 Repository
Task 4: 工具类 AuthHelper / monoUtil
Task 5: 种子数据 DataLoader
Task 6: init & passwordEncoder + 错误处理
Task 7: DTO 与接口文档
Task 8: 路由拦截器 + AutoContext
Task 9: API Key 管理、鉴权
Task 10: 接入模拟 ModelProvider
Task 11: 配置适配器 ChatProvider
Task 12: ChatService / ChatController 非流式
Task 13: Chat 流式 SSE
```
（pnpm workspace 管理 + superpowers/ 目录承载工作流）

---

## 六、四条主线收敛与可复用清单

```
主线 1（Graph 工程化，徐庶）：Loop 黑盒 → StateGraph 白盒（可观测/可中断/可恢复/可并行）
主线 2（Harness 工程化，诸葛）：Model 商品化 → Harness 五层（Memory/Tools/Permissions/Hooks/Observability）
主线 3（Skill 工程化，诸葛）：系统提示塞满 → 按需技能库（触发条件/前置/流程/模板/scripts）
主线 4（流程工程化，两线共用）：自由发挥 → 十阶段流水线 + Quality Gate + 评审循环 + ledger 记账
```

**可直接复用的规范实践清单**（每条都有本总结里的出处）：

1. **Graph 编排**：节点写决策、边读决策（读写分离）；HITL 续传必须带 HUMAN_FEEDBACK_METADATA_KEY（缺了从头跑）；要检测中断必须 stream() 不 invoke()；子图匿名、主图命名；无入边的节点永不执行（Mermaid 对 ≠ 行为对）；并行必须 addParallelNodeExecutor 否则是假的
2. **Harness 搭建**：CLAUDE.md 是"失败日志"不是"愿望清单"（每条规则来自一次真实 Agent 错误）；先加约束（Hooks exit 2）再给能力（Tools）；约束 > 能力（53.9% < 63.6%）
3. **编码规范**：金额 Integer 分单位、BusinessException 体系 + 全局处理器、构造器注入、@Transactional(rollbackFor)、常量类私有构造、枚举替代 int 状态、@Slf4j 占位符、ThreadLocal 上下文（AuthenticationFilter 写入）
4. **Skill 编写**：统一结构 `触发条件 → 前置条件 → 上下文准备(≤4) → 执行流程 → 代码模板 → 红线/降级`；description 写清"何时用"；可执行技能带 scripts/ CLI 封装
5. **流水线治理**：十阶段串行 + 每阶段 Quality Gate（覆盖率 80%、红线零违反、CI 全绿）；分支与 changes 同名
6. **聚合平台**：OpenAI 兼容 API（/v1/chat/completions）；预付-结算-补差计费；SSE 流结束后一次性结算；错误统一 OpenAI 风格

---

## 七、与本人项目（一盏茶 tea）的映射

| 图灵课程做法 | tea 项目对应物 | 差距 |
|--------------|----------------|------|
| harness/rules+skills+wiki+changes 四层 | `.harness/rules` + `.harness/skills` + `.harness/wiki` + `.harness/changes` | 已对齐 ✅ |
| 十阶段流水线 + Quality Gate | AGENTS.md §4 三轨道（Fast/Guided/Controlled） | 已对齐 ✅ |
| 三族技能体系（main/biz/trouble-shooting） | 技能族（main-dev 9 / biz-dev 19 / trouble-shooting 5） | 已对齐 ✅ |
| Skill 统一模板（触发/前置/上下文/流程/红线） | 技能规范 frontmatter（type/verification）+ 触发式描述 | 已对齐 ✅ |
| 规则=全量常驻、技能=渐进加载（token 红线） | AGENTS.md §2 同款红线（token 分工红线） | 已对齐 ✅ |
| CLAUDE.md 红线 8 条（金额 Integer/构造器注入/@Transactional 等） | AGENTS.md §7 后端规范 + 编码规范 15 条红线 | 已对齐 ✅ |
| Biz Skill 13 个（redis-cache/excel-import-export/db-migration…） | 同名能力分散在各族技能（db-migration/fastapi-endpoint/vue-component 等） | 已对齐 ✅ |
| Spring AI Alibaba Graph HR 项目 | **未引入 Graph 编排**（ADR-018 判定暂缓：业务闭环无多步有状态 AI 编排环节） | 有结论 ✅ |
| OOM/慢 SQL 排查 Skill | tea 无线上故障排查类技能（本地开发项目，暂无生产排障场景） | 可备选 |
| Cache Aside 标准模板 | tea 无 Redis 缓存层（离线优先 PWA + IndexedDB） | 不适用 |

**结论**：图灵这套课程与 tea 项目治理框架高度同构——差异不在方法论，而在**具体的 AI 编排场景**。徐庶老师的 Graph 课给出了 Java 生态"有状态、可中断、可分支"AI 流程的完整代码范式（HITL 五步曲、条件边读写分离、子图并行），若 tea 未来出现多步有状态 AI 编排需求（如品鉴流水线的人工确认环节），可直接复用其代码骨架；Graph 暂缓结论（ADR-018）在业务闭环无此需求前保持有效。

---

## 附：学习过程与方法说明

- 语雀文档：全文 15309 字精读提取（22 技术点 + 项目细节），5 张图（2 界面截图 + 3 Mermaid 流程图）逐张解析，主图 15 节点 + 子图 8 节点全部还原
- 视频：4 个全部完整下载（共约 3.3GB），2 分钟间隔抽帧 363 张（A2=104/B2=93/C2=81/D2=85），按文字密度排序重点读取代码/PPT 画面约 40 张，逐帧 OCR 取证
- 飞书妙记转写未使用（授权失败，遵守技能约束不绕过第三方转写）；关键信息通过画面 OCR + 语雀原文交叉验证
- 视频文件保留于 `C:\Users\yanha\AppData\Local\Temp\course_videos\`，抽帧证据在 `C:\Users\yanha\AppData\Local\Temp\frames_A2|B2|C2|D2\`，可自行复核
