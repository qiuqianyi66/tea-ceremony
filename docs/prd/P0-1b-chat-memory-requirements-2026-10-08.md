---
last_updated: 2026-10-08
status: draft
owner: yanha
---

# P0-1b 会话记忆（ChatMemoryService）需求文档

> 事实来源：`backend/src/main/resources/db/migration/V3__agent_memory.sql`、`backend/src/main/java/com/tea/**`、`src/services/teaAI.ts`、`src/services/storage/db.ts`、`.harness/wiki/api-contract.md`、`docs/prd/m5-agent-product-prd.md` 均已读原文核实，无编造。
> 状态：**待用户确认**。本 PRD 细化 `docs/prd/m5-agent-product-prd.md` F-M5-5（会话记忆 S2 新表），不重复立项。

## 0. 背景与目标

- 会话记忆 = 278 研究「Save Plan」多轮上下文锚定：把对话意图与历史持久化，每轮取出作锚点，防长对话跑偏（research-multiagent-278 §5 记忆模块）。
- 目标：`ChatMemoryService` 读写 `ai_chat_sessions`/`ai_messages`（表已就绪），`AiChatService.chat()` 支持可选 `sessionId`，向后兼容；不依赖 AI key，降级链保持。

## 1. 现状事实（已核实）

| 项 | 事实 |
|---|---|
| 表 | V3 迁移已建两表，**无 JPA 实体**（ai 包 entity 下仅 AiUsageLog）。ai_chat_sessions(id, user_id, topic, agent, created_at, updated_at)；ai_messages(id, session_id, role, content, agent, tokens, created_at, FK ON DELETE CASCADE)。游客不落库（表注释） |
| 服务 | `AiChatService.chat(Integer userId, AiChatRequest)` 存在但**无状态**：不查会话、不落消息；`AiChatRequest(messages 1-20 条, agent?)` 无 sessionId 字段 |
| 编排 | `AgentOrchestrator.routeToAgent(req)` 返回 AgentType（chat/advisor/taster/librarian/brewer/mentor）；五专家 `@Component` 构造注入 AiChatService |
| 前端 | `teaAI.ts askTeaMaster(question, history)` 降级链三分支（!res.ok / content 空 / 异常 → ruleBasedReply 四级规则）；无 sessionId 概念；聊天 UI 仅 AIAsk.vue 纯内存态 |
| 契约 | api-contract wiki 新栈 `POST /api/v1/ai/chat` 已登记；**会话端点未登记**，新增须按表列格式登记（wiki :181 规则） |
| 配置 | `ddl-auto: validate`（红线 #7）；`spring.ai.dashscope.api-key: ${AI_DASHSCOPE_API_KEY:disabled}` |

**漂移记录（本次只记录不修）**：D1 AGENTS.md §3「/api/ai/*」vs 实际 `/api/v1/ai/chat`；D2 AGENTS.md §3 `sync_status` vs 实际 `syncStatus` 驼峰；D3 PRD-spring-ai-refactor-v2 设计字段 title/model vs V3 落地 topic/agent；D4 AGENTS.md §7「BusinessError」vs 实际类名 `BusinessException`。

## 2. 范围边界

**做什么**：AiChatSession/AiMessage 实体 + 2 Repository；ChatMemoryService（建/列/删会话、存消息、锚定历史）；会话端点 4 个（POST/GET/DELETE + GET messages）；AiChatService.chat() 接入可选 sessionId（向后兼容）；api-contract.md 登记；Service 单测 + ArchUnit 分层（自动）+ mvn test。

**不做什么（明确排除）**：前端 UI（会话列表/历史回看，留后续）；`teaAI.ts` 改动（承重墙，sessionId 后端先行）；IndexedDB 会话表与同步（前端不存会话）；游客会话（隐私，表注释）；向量检索/embedding（P0-1c）；消息编辑/摘要/定时清理；跨设备同步；任何表结构迁移（新表无 client_id 幂等列，见 D-5）。

## 3. 需求（F-编号）

| F-编号 | 需求 | 优先级 |
|---|---|---|
| F-1 | 创建会话：POST /api/v1/ai/sessions，请求 {topic?, agent?}，响应含 id | P0 |
| F-2 | 会话列表：GET /api/v1/ai/sessions，仅当前用户，updated_at 倒序 | P0 |
| F-3 | 历史消息：GET /api/v1/ai/sessions/{id}/messages，created_at 正序 | P0 |
| F-4 | 删除会话：DELETE /api/v1/ai/sessions/{id}，消息级联删（DB CASCADE） | P0 |
| F-5 | chat 落库：chat 带 sessionId → 本次 user 与 assistant 消息写入 ai_messages，agent 列 = 路由专家 code | P0 |
| F-6 | 多轮锚定（278 Save Plan）：chat 带 sessionId → 请求 LLM 的 messages 前插历史（≤20 条） | P0 |
| F-7 | 无 sessionId 兼容：chat 不带 sessionId → 行为与现状完全一致（不查史不落库） | P0 |
| F-8 | 降级链不变量：AI key 未配（502）或网络异常 → 用户消息仍落库，返回规则回复路径，不抛未捕获异常 | P0 |
| F-9 | 越权：访问他人会话 → 404（不泄露存在性） | P0 |
| F-10 | 游客：未登录访问会话端点 → 401 | P0 |

## 4. 验收标准（Given-When-Then）

- **F-1**：Given 登录用户 / When POST /api/v1/ai/sessions {topic:"存茶问法"} / Then 返回 id 与 created_at，ai_chat_sessions 落一行 user_id=当前用户。
- **F-2**：Given 该用户有 3 会话、他人有 2 / When GET /api/v1/ai/sessions / Then 仅返回 3 个，updated_at 倒序。
- **F-3**：Given 会话有 4 条消息 / When GET /api/v1/ai/sessions/{id}/messages / Then 按 created_at 正序返回，含 role/content/agent/tokens。
- **F-4**：Given 会话含消息 / When DELETE /api/v1/ai/sessions/{id} / Then 会话删除且 ai_messages 级联清空（CASCADE）。
- **F-5**：Given 会话存在 + chat 带 sessionId / When 一次成功 chat / Then ai_messages 新增 2 行（user + assistant），agent 列 = 路由结果 code。
- **F-6**：Given 会话已有历史 / When 新一轮 chat 带 sessionId / Then LLM 请求 messages 前缀含历史（≤20 条），回复落库。
- **F-7**：Given chat 不带 sessionId / When 请求 / Then 不查 ai_chat_sessions、不写 ai_messages，响应与现状一致。
- **F-8**：Given AI key 为 disabled / When chat 带 sessionId / Then 用户消息已落库（事务提交），响应走规则回复，无 500。
- **F-9**：Given 会话属于他人 / When GET 其 messages 或 DELETE / Then 404，响应不含会话任何信息。
- **F-10**：Given 未登录 / When 任一会话端点 / Then 401（Security 默认拦截，与既有端点一致）。

## 5. 非功能约束

- `ddl-auto: validate`：实体列名/类型必须与 V3 DDL 逐一对齐，否则启动失败（红线 #7）。
- 分层：Controller → Service → Repository 单向；Controller 只做路径/鉴权/调用/响应声明（ArchUnit CI 门禁自动覆盖）。
- 事务：写方法 `@Transactional(rollbackFor = Exception.class)`；只读 `readOnly = true`；禁事务内远程调用。
- 构造器注入（`final` + `@RequiredArgsConstructor`）；禁字段注入。
- 四层对象：DTO/Entity/VO 分离，Entity 禁止出参（VO 转换照 TastingRecordService 风格）。
- 异常：继承 `BusinessException` 体系（BadRequest/Unauthorized/NotFound/Conflict），禁裸抛。
- 隐私：游客不落库；会话归属按 userId 过滤。

## 6. 影响分析

| 面 | 分析 |
|---|---|
| 承重墙 | teaAI.ts 降级链三分支**不动**；chat 接口向后兼容（sessionId 可空），前端不改造也能用 |
| 契约 | AiChatRequest record 加 `Integer sessionId`（可空）；api-contract.md 补 4 个会话端点登记行 |
| 同步逻辑 | 前端不存会话，不涉及 IndexedDB syncStatus；后端无同步语义 |
| 迁移 | 旧 FastAPI 无会话表（Alembic grep 零命中），无旧模型需迁移 |
| 回滚 | 新增文件可整体删除；AiChatService 仅一处接入点 + 可回退；端点下线即恢复 |
| 风险点 | 502 降级路径下消息落库的事务顺序（先落库再抛/返回，避免丢用户消息）；历史锚定条数需定上限（D-2） |

## 7. 决策点（D-编号）

| D-编号 | 决策 | 选项 | 建议 | 状态 |
|---|---|---|---|---|
| D-1 | chat 的 sessionId 放哪 | A: AiChatRequest 加可空字段；B: 独立参数/header | A（向后兼容，前端可不改） | 待拍板 |
| D-2 | 历史锚定条数上限 | 10 / 20 / 按 tokens | 20（tokens 列在无 AI key 时 null，不可依赖） | 待拍板 |
| D-3 | topic 缺省值 | A: 空；B: 首条 user 消息前 20 字 | B（否则列表页无标题） | 待拍板 |
| D-4 | 删除会话是否本次范围 | A: 含；B: 不含（最小集） | A（CASCADE 现成，代价低） | 待拍板 |
| D-5 | 消息写入幂等 | A: 不加（前端控制，不动表）；B: 加 client_id 需 L3 迁移 | A（本次 L2 不动表） | 待拍板 |

## 8. 架构样例（审阅用，不落盘 src/）

代码风格对齐 `ai/entity/AiUsageLog.java` 与 `record/` 垂直切片（已核实）。`ddl-auto: validate` 要求列名逐一对齐 V3。

**实体 AiChatSession**（com.tea.ai.entity）
```java
@Entity @Getter @Setter
@Table(name = "ai_chat_sessions")
public class AiChatSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(name = "user_id", nullable = false)
    private Integer userId;
    @Column(name = "topic", length = 100)
    private String topic;
    @Column(name = "agent", length = 50)
    private String agent;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    @PrePersist void prePersist() { LocalDateTime n = LocalDateTime.now(); createdAt = n; updatedAt = n; }
    @PreUpdate void preUpdate() { updatedAt = LocalDateTime.now(); }
}
```

**实体 AiMessage**
```java
@Entity @Getter @Setter
@Table(name = "ai_messages")
public class AiMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(name = "session_id", nullable = false)
    private Integer sessionId;
    @Column(name = "role", length = 20, nullable = false)
    private String role;                 // system|user|assistant（DTO 层已限定）
    @Column(name = "content", columnDefinition = "TEXT")
    private String content;
    @Column(name = "agent", length = 50)
    private String agent;
    @Column(name = "tokens")
    private Integer tokens;              // 无 AI key 时为 null，锚定不依赖它
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @PrePersist void prePersist() { createdAt = LocalDateTime.now(); }
}
```

**Repository ×2**（com.tea.ai.repository，照 TastingRecordRepository 风格）
```java
public interface AiChatSessionRepository extends JpaRepository<AiChatSession, Integer> {
    List<AiChatSession> findByUserIdOrderByUpdatedAtDesc(Integer userId);
    Optional<AiChatSession> findByIdAndUserId(Integer id, Integer userId);
}
public interface AiMessageRepository extends JpaRepository<AiMessage, Integer> {
    List<AiMessage> findBySessionIdOrderByCreatedAtAsc(Integer sessionId);
    List<AiMessage> findTop20BySessionIdOrderByCreatedAtAsc(Integer sessionId);  // 锚定上限
}
```

**ChatMemoryService 接口 + 实现骨架**（com.tea.ai.service）
```java
public interface ChatMemoryService {
    AiChatSession createSession(Integer userId, String topic, String agent);
    List<AiChatSession> listSessions(Integer userId);
    List<AiMessage> listMessages(Integer userId, Integer sessionId);   // 归属校验：404
    void deleteSession(Integer userId, Integer sessionId);
    void saveExchange(Integer sessionId, String userContent, String agent, String assistantContent);
    List<AiMessage> anchorHistory(Integer userId, Integer sessionId);  // 278 Save Plan
}

@Service @RequiredArgsConstructor
public class ChatMemoryServiceImpl implements ChatMemoryService {
    private final AiChatSessionRepository sessionRepo;
    private final AiMessageRepository messageRepo;

    @Override @Transactional
    public AiChatSession createSession(Integer userId, String topic, String agent) {
        AiChatSession s = new AiChatSession();
        s.setUserId(userId); s.setTopic(topic); s.setAgent(agent);
        return sessionRepo.save(s);
    }

    @Override @Transactional
    public void saveExchange(Integer sessionId, String userContent, String agent, String assistantContent) {
        messageRepo.save(newMessage(sessionId, "user", userContent, agent));
        messageRepo.save(newMessage(sessionId, "assistant", assistantContent, agent));
    }

    @Override @Transactional(readOnly = true)
    public List<AiMessage> anchorHistory(Integer userId, Integer sessionId) {
        AiChatSession s = sessionRepo.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("会话不存在"));
        return messageRepo.findTop20BySessionIdOrderByCreatedAtAsc(sessionId);
    }
}
```

**AiChatService.chat() 接入（向后兼容 diff）**
```java
// AiChatRequest record 新增一行（D-1 待拍板）：
//     @Positive Integer sessionId    // 可空；null = 现状无状态

// chat() 改造（伪 diff，承重墙分支不动）：
// 1) 有 sessionId：
//    List<AiMessage> history = chatMemory.anchorHistory(userId, req.sessionId());
//    messages 组包时 history 前插（role/content 直转，忽略 tokens/agent）
// 2) 回复成功：chatMemory.saveExchange(sessionId, lastUserMsg, agentCode, resp);
// 3) 502/异常：先 saveExchange 用户消息（事务已提交），再走既有降级抛出路径
// 4) 无 sessionId：现状代码零改动路径
```

**api-contract.md 登记样例**（按既有表列格式 `| 方法 | 路径 | 请求体 | 成功响应 | 错误 |`）
```
| POST | /api/v1/ai/sessions | {topic?≤100, agent?≤50} | ApiResponse<{id, topic, agent, createdAt}> | 401 / 400 |
| GET | /api/v1/ai/sessions | - | ApiResponse<[{id, topic, agent, updatedAt}]> | 401 |
| GET | /api/v1/ai/sessions/{id}/messages | - | ApiResponse<[{id, role, content, agent, tokens, createdAt}]> | 401 / 404 |
| DELETE | /api/v1/ai/sessions/{id} | - | ApiResponse<{message}> | 401 / 404 |
```

**G1 ci.yml 改动样例**（harness-consistency job 追加一步）
```yaml
      # eval-harness 用法（已核实）：node scripts/eval-harness.cjs <切片名> [--verify]
      #   <切片名> = .harness/changes/ 下目录名（如 m5-s2）；总分<60 退出码 1 阻断 CI
      #   --verify 未传则正确性维记 0 分（失败响亮）；CI 上切片选取见 PLAN Open Question O-5
      - name: Run eval harness gate
        run: node scripts/eval-harness.cjs <切片名>
```
