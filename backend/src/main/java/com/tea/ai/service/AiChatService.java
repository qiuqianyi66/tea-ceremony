package com.tea.ai.service;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.resilience.AiCallExecutor;
import com.tea.ai.util.ChatResponseText;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.QuotaExceededException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;

/**
 * AI 聊天服务（M5-S2：五专家派发 + 透明代理回落 + 会话记忆旁路）。
 * 承重墙：key 不可用/上游失败 → 502（前端 teaAI.ts 降级规则引擎）；仅成功调用落计量。
 * 路由：AgentOrchestrator 判定专家类型；null/CHAT 回落透明代理（T11 行为不变）。
 * 记忆旁路：登录用户会话内落库——F-8 用户消息 dispatch 前先行（502 不丢），assistant 成功后落；落库失败不影响 AI 响应（同计量旁路）。
 * 多轮锚定：带 sessionId → 历史 ≤20 前插（F-6，278 Save Plan）。
 * 防越权：带 sessionId 时先 requireSession（非本人 → 404 显式失败）。
 */
@Slf4j
@Service
public class AiChatService {

    /** 多轮锚定上限（与 ChatMemoryService.ANCHOR_LIMIT 一致）。 */
    private static final int ANCHOR_LIMIT = 20;

    private final ChatClient chatClient;
    private final AiUsageLogger usageLogger;
    private final AgentOrchestrator orchestrator;
    private final ChatMemoryService memoryService;
    private final TraceRecorder traceRecorder;
    private final LibrarianAgent librarianAgent;
    private final AdvisorAgent advisorAgent;
    private final TasterAgent tasterAgent;
    private final BrewerAgent brewerAgent;
    private final MentorAgent mentorAgent;

    /**
     * 专家派发表（审计 #7：收敛散弹式改动）。新增专家只需在此登记一行，
     * 替代原先逐个 {@code if (type == AgentType.X)} 的分支堆叠；忘了登记由
     * {@code AgentDispatchRegistryTest} 兜底变红。
     *
     * <p>键不含 {@code CHAT}：它与 {@code null} 一样回落透明代理，故不登记。
     * 不可变 {@code Map.of} 的 {@code get(null)} 会 NPE，查表前必须先判 null。</p>
     */
    final Map<AgentType, BiFunction<Integer, AiChatRequest, AiChatVo>> experts;
    private final AiCallQuota callQuota;
    /**
     * P1-13 熔断：上游连续失败达阈值后快速 502（前端降级链不变）。
     * 2026-10-18 起熔断器按 lane 分桶，本类只做「请求入口层」的粗粒度门禁，用的是 default 桶（无参旧 API）；
     * 真实链路（chat/librarian/...）的桶由 AiCallExecutor 在每次尝试上报告。
     * 两层不是同一桶：入口层保留原行为（既有测试与前端语义都依赖它），执行器层才做按链路隔离。
     * 维护提示：不要因为「执行器内部已经报过熔断」就删掉这里的两处调用——入口层拦的是
     * 「连上游都不该试」的快速失败，删了会让熔断窗口内仍然逐次进 dispatch。
     */
    private final AiCircuitBreaker circuitBreaker;
    /** 激活的 ChatModel 提供商（spring.ai.model.chat）：openai（gateway profile）或 dashscope（生产）。 */
    private final String modelChat;
    private final String dashscopeApiKey;
    private final String openaiApiKey;
    /** 容错骨架（深度/熔断/超时/重试）：透明代理这一处 LLM 调用走它，lane = chat。 */
    private final AiCallExecutor aiCallExecutor;
    /** 多级兜底第 2 级：本地规则库（上游不可用时给有依据的答复，而不是只回 502）。 */
    private final LocalFallbackService localFallbackService;
    /** A/B 实验（ADR-024）：控制「后端规则兜底」的灰度范围。 */
    private final ExperimentService experimentService;

    /** 兜底灰度的实验键（实验未创建/未运行时保持现状：兜底开启）。 */
    static final String FALLBACK_ROLLOUT_EXPERIMENT = "ai.fallback.rollout";

    /**
     * 单参构造：18 个依赖由 {@link AiChatDeps} 聚合传入。
     *
     * <p>为什么不再逐个参数：18 个参数是强依赖链的中心，调用点靠位置对齐、同类型参数错配编译不报错。
     * 聚合后依赖清单只有一处权威定义（record），本类只按字段名取值，语义自证。</p>
     *
     * <p>不加 {@code @Autowired}：单构造器由 Spring 4.3+ 自动选用，与本项目其余服务的构造器注入风格一致。</p>
     *
     * <p>行为不变：ChatClient 仍只 build 一次，赋值逐字段一一对应，不做任何额外校验或转换。</p>
     */
    public AiChatService(AiChatDeps deps) {
        this.chatClient = deps.chatClientBuilder().build();
        this.usageLogger = deps.usageLogger();
        this.orchestrator = deps.orchestrator();
        this.memoryService = deps.memoryService();
        this.traceRecorder = deps.traceRecorder();
        this.librarianAgent = deps.librarianAgent();
        this.advisorAgent = deps.advisorAgent();
        this.tasterAgent = deps.tasterAgent();
        this.brewerAgent = deps.brewerAgent();
        this.mentorAgent = deps.mentorAgent();
        this.callQuota = deps.callQuota();
        this.circuitBreaker = deps.circuitBreaker();
        this.modelChat = deps.modelChat();
        this.dashscopeApiKey = deps.dashscopeApiKey();
        this.openaiApiKey = deps.openaiApiKey();
        this.aiCallExecutor = deps.aiCallExecutor();
        this.localFallbackService = deps.localFallbackService();
        this.experimentService = deps.experimentService();
        this.experts = Map.of(
                AgentType.LIBRARIAN, librarianAgent::chat,
                AgentType.ADVISOR, advisorAgent::chat,
                AgentType.TASTER, tasterAgent::chat,
                AgentType.BREWER, brewerAgent::chat,
                AgentType.MENTOR, mentorAgent::chat);
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        // 防越权前置：带 sessionId 且登录 → 归属校验先行（非本人 404，不浪费 LLM 调用）
        if (userId != null && req.sessionId() != null) {
            memoryService.requireSession(userId, req.sessionId());
        }
        AgentType type = orchestrator.routeToAgent(req);
        // T09 复杂度路由：SIMPLE 且隐式路由 → 跳过专家/RAG 直答；显式 agent 尊重用户选择
        ComplexityLevel level = orchestrator.complexity(req);
        if (level == ComplexityLevel.SIMPLE && (req.agent() == null || req.agent().isBlank())) {
            type = null;
        }
        // F-6 多轮锚定（278 Save Plan）：有 sessionId → 历史前插进请求 messages（COMPLEX 收紧至 5 条=上下文压缩）
        AiChatRequest anchored = anchor(userId, req, level);
        // F-8 降级不丢用户消息：dispatch 前先落库（LLM 失败/502 时用户消息已提交，响应仍走既有降级抛出路径）
        Integer sessionId = resolveSession(userId, req, type);
        // F-6 会话配额（ADR-018）：仅对「登录 + sessionId」生效；前端匿名调用 sessionId==null 直接放行。
        // 超限走 429（QuotaExceededException），与 BadGatewayException（502 上游不可用）语义区分。
        if (!callQuota.tryAcquire(sessionId)) {
            throw new QuotaExceededException("本轮对话已达上限（" + callQuota.maxCalls() + " 次），请开新会话继续");
        }
        persist(sessionId, "user", lastUserMessage(req), agentOf(type, req));
        // ADR-024 灰度：assignActive 为空 = 实验未运行 → 保持现状（兜底开启）；
        // 返回 control = 实验明确把这批主体划到旧路径（只回 502，不走规则库）。
        // 这个区分是必须的：若用 assign()，未配置实验也会得到 control，等于上线一个新实验
        // 反而把已有兜底关掉。
        String subject = subjectOf(userId, sessionId);
        Map<String, String> experiments = new LinkedHashMap<>();
        Optional<String> rollout = experimentService.assignActive(FALLBACK_ROLLOUT_EXPERIMENT, subject);
        rollout.ifPresent(v -> experiments.put(FALLBACK_ROLLOUT_EXPERIMENT, v));
        String variant = rollout.orElse(null);
        // degradeAllowed 只看兜底实验：它是「上游失败后是否走规则库」的唯一开关，
        // 不能因为其它实验（如 librarian 工具调用）的变体不同而改变兜底行为。
        boolean degradeAllowed = variant == null || ExperimentService.TREATMENT.equals(variant);
        // 只在真的会走 librarian 的请求上评估 tool-calling 实验：其它专家不受它影响，
        // 若一律记录归属，实验指标里会混进没有经过该开关的流量，对比结果失真。
        if (type == AgentType.LIBRARIAN) {
            // 这里与 LibrarianAgent 内部各算一次：分桶是确定性哈希（同 expKey + 同主体恒定同结果），
            // 且 assignActive 有 30 秒快照缓存，重复调用不额外打库；换来的是两条链路口径一致，
            // 不需要把结果从 Agent 反传回服务层（那要改 Agent 返回值形状，影响面更大）。
            experimentService.assignActive(LibrarianAgent.TOOL_CALLING_EXPERIMENT, subject)
                    .ifPresent(v -> experiments.put(LibrarianAgent.TOOL_CALLING_EXPERIMENT, v));
        }
        // T07 评测 Trace：入口埋点（input/context/plan 层，含复杂度档位与多实验归属），dispatch 后 complete/fail（ADR-016）。
        // 顶层 variant/experiment 继续写兜底实验：历史行与既有查询口径不变。
        AiEvalTrace trace = traceRecorder.begin(sessionId, type, req, anchored, level, variant,
                variant == null ? null : FALLBACK_ROLLOUT_EXPERIMENT, experiments);
        // P1-13 熔断：OPEN 窗口内快速失败（不调 LLM）。多级兜底第二级在此先试本地规则库，未命中才 502
        if (!circuitBreaker.allowCall()) {
            return fallbackOrThrow(anchored, sessionId, trace, degradeAllowed,
                    new BadGatewayException("AI 服务暂时不可用（熔断保护中）"));
        }
        try {
            AiChatVo vo = dispatch(type, userId, anchored);
            circuitBreaker.onSuccess();
            traceRecorder.complete(trace, vo);
            if (sessionId != null) {
                persist(sessionId, "assistant", vo.content(), agentOf(type, req));
                // degraded 一并透传：专家层若已降级，绑定会话后不能把标记丢掉
                return new AiChatVo(vo.content(), vo.sources(), sessionId,
                        vo.tokensIn(), vo.tokensOut(), vo.latencyMs(), vo.degraded());
            }
            return vo;
        } catch (BadGatewayException e) {
            circuitBreaker.onFailure();
            return fallbackOrThrow(anchored, sessionId, trace, degradeAllowed, e);
        }
    }

    /** 分桶主体：优先登录用户（体验稳定），其次会话（游客可分桶，且不会因换设备跳到另一组）。 */
    private static String subjectOf(Integer userId, Integer sessionId) {
        if (userId != null) {
            return "u:" + userId;
        }
        return sessionId == null ? null : "s:" + sessionId;
    }

    /**
     * 多级兜底第二级：上游不可用 → 本地规则库（截图「兜底 Downgrade：核心服务不可用时调用本地规则库」）。
     *
     * <p>命中 → 200 + {@code degraded=true}，用户仍得到有数据依据的答复；同时补落 assistant 消息，保持会话历史完整。
     * 未命中 → 原样抛 502，由前端 {@code teaAI.ts} 走第三级规则降级。
     * <b>承重墙不变</b>：502 语义保留在「未命中」分支，前端降级链无需改动。</p>
     *
     * <p>为什么在入口熔断分支也走这里：熔断态下用户拿到的应该是规则答复，而不是一条 502。
     * 这不会让上游过载——本地规则库不发起任何网络调用。</p>
     */
    private AiChatVo fallbackOrThrow(AiChatRequest anchored, Integer sessionId,
                                     AiEvalTrace trace, boolean degradeAllowed, BadGatewayException e) {
        // Trace 一律记为失败：上游确实失败了，指标口径必须如实反映（兜底命中与否不影响这个事实）
        traceRecorder.fail(trace, e);
        if (!degradeAllowed) {
            // A/B 对照组：保持 ADR-023 之前的旧语义（直接 502，前端 teaAI.ts 兜第三级）
            throw e;
        }
        Optional<String> ruleAnswer = localFallbackService.answerFor(lastUserMessage(anchored));
        if (ruleAnswer.isEmpty()) {
            throw e;
        }
        String content = ruleAnswer.get();
        persist(sessionId, "assistant", content, "fallback");
        log.info("ai degraded to local rule fallback: sessionId={} reason={}", sessionId, e.getMessage());
        return new AiChatVo(content, List.of("本地规则库"), sessionId, null, null, null, true);
    }

    /** F-6 多轮锚定：登录 + 有 sessionId → 读历史（归属已在 chat() 入口 requireSession 校验，这里直接取消息，免二次查库）转 ChatMessageDto 前插；其余原样返回。COMPLEX → 只取最后 5 条（上下文压缩，T09）。 */
    private AiChatRequest anchor(Integer userId, AiChatRequest req, ComplexityLevel level) {
        if (userId == null || req.sessionId() == null) {
            return req;
        }
        List<AiChatMessage> history = memoryService.history(req.sessionId(), ANCHOR_LIMIT);
        if (history == null || history.isEmpty()) {
            return req;
        }
        List<ChatMessageDto> prefix = new ArrayList<>();
        int maxHistory = level == ComplexityLevel.COMPLEX ? 5 : 20;
        int from = Math.max(0, history.size() - maxHistory);
        for (int i = from; i < history.size(); i++) {
            AiChatMessage m = history.get(i);
            if (m.getContent() == null || m.getContent().isBlank()) {
                continue;
            }
            if ("user".equals(m.getRole()) || "assistant".equals(m.getRole())) {
                prefix.add(new ChatMessageDto(m.getRole(), m.getContent()));
            }
        }
        if (prefix.isEmpty()) {
            return req;
        }
        List<ChatMessageDto> all = new ArrayList<>(prefix);
        all.addAll(req.messages());
        return new AiChatRequest(all, req.agent(), req.sessionId());
    }

    /** 会话解析：游客 null（不落）；已有 sessionId 原样；登录无 sessionId → 开新会话（用户 M5-S2 语义）。失败仅 warn 返回 null。 */
    private Integer resolveSession(Integer userId, AiChatRequest req, AgentType type) {
        if (userId == null) {
            return null;
        }
        if (req.sessionId() != null) {
            return req.sessionId();
        }
        try {
            return memoryService.createSession(userId, topicOf(req), agentOf(type, req)).getId();
        } catch (Exception e) {
            log.warn("create chat session failed: {}", e.getMessage());
            return null;
        }
    }

    /** 落一条消息（旁路：失败仅 warn，不影响已成功路径；F-8 用户消息先行由调用时序保证）。 */
    private void persist(Integer sessionId, String role, String content, String agent) {
        if (sessionId == null) {
            return;
        }
        try {
            memoryService.appendMessage(sessionId, role, content, agent, null);
        } catch (Exception e) {
            log.warn("save chat message failed: {}", e.getMessage());
        }
    }

    /**
     * 五专家派发；null/CHAT 回落透明代理。
     * 查表替代分支堆叠：圈复杂度 6 → 1，行为逐路径等价（未登记的类型与 null 同回透明代理）。
     */
    private AiChatVo dispatch(AgentType type, Integer userId, AiChatRequest req) {
        BiFunction<Integer, AiChatRequest, AiChatVo> expert = type == null ? null : experts.get(type);
        return expert == null ? transparentChat(userId, req) : expert.apply(userId, req);
    }

    private String agentOf(AgentType type, AiChatRequest req) {
        if (req.agent() != null) {
            return req.agent();
        }
        // 透明代理（type 为 null）归 chat，与 api-contract 一致
        return type == null ? "chat" : type.name().toLowerCase();
    }

    /** 会话标题（chat 自动建会话时缺省）：首条用户消息前 20 字（决策 D-3/O-6 拍板；空 → 空串）。 */
    private String topicOf(AiChatRequest req) {
        for (ChatMessageDto m : req.messages()) {
            if ("user".equals(m.role()) && m.content() != null && !m.content().isBlank()) {
                String c = m.content();
                return c.length() > 20 ? c.substring(0, 20) : c;
            }
        }
        return "";
    }

    /** 最后一条用户消息（截断 500 字，防超长输入；与 BaseExpertAgent 同规则）。 */
    private String lastUserMessage(AiChatRequest req) {
        for (int i = req.messages().size() - 1; i >= 0; i--) {
            ChatMessageDto m = req.messages().get(i);
            if ("user".equals(m.role())) {
                String c = m.content();
                return c.length() > 500 ? c.substring(0, 500) : c;
            }
        }
        return "";
    }

    /** 透明代理（type == null 或 CHAT；T11 行为不变）。承重墙按激活 model 校验对应 key：openai → 网关 key，否则 DashScope key。 */
    private AiChatVo transparentChat(Integer userId, AiChatRequest req) {
        String key = "openai".equals(modelChat) ? openaiApiKey : dashscopeApiKey;
        if (key == null || key.isBlank() || "disabled".equals(key)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }

        List<Message> messages = toSpringMessages(req.messages());
        long start = System.currentTimeMillis();
        // 透明代理这一跳的容错全交给 AiCallExecutor（硬超时 + 重试 + 熔断按 lane=chat 隔离）；
        // 失败已由执行器统一转 502，这里不再二次 try/catch，避免把业务异常也吞成 502。
        ChatResponse response = aiCallExecutor.execute("chat", () -> chatClient.prompt()
                .messages(messages)
                .call()
                .chatResponse(), null);
        int latency = (int) (System.currentTimeMillis() - start);

        String content = ChatResponseText.requireNonBlank(response);

        // 计量失败不影响已成功的 LLM 响应（旁路观测）
        try {
            usageLogger.save(userId, req, response, latency);
        } catch (Exception e) {
            log.warn("save usage log failed: {}", e.getMessage());
        }
        Usage usage = response.getMetadata().getUsage();
        Integer tokensIn = usage == null ? null : usage.getPromptTokens();
        Integer tokensOut = usage == null ? null : usage.getCompletionTokens();
        return new AiChatVo(content, null, null, tokensIn, tokensOut, latency);
    }

    private List<Message> toSpringMessages(List<ChatMessageDto> dtos) {
        List<Message> messages = new ArrayList<>();
        for (ChatMessageDto dto : dtos) {
            switch (dto.role()) {
                case "system" -> messages.add(new SystemMessage(dto.content()));
                case "assistant" -> messages.add(new AssistantMessage(dto.content()));
                default -> messages.add(new UserMessage(dto.content()));
            }
        }
        return messages;
    }
}
