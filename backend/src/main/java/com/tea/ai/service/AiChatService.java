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
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    /** 流式 SSE 超时（ms）：覆盖 LLM 首 chunk + 生成；前端 30s 超时，后端留余量。 */
    private static final long STREAM_TIMEOUT_MS = 60_000L;

    /**
     * 流式工作线程池：SseEmitter 建立后 LLM 生成在独立线程跑（MVC 异步）。
     * daemon 线程，不阻塞 JVM 退出；包级可见便于单测替换为同步执行（Runnable::run）。
     */
    Executor streamExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "ai-sse-stream");
        t.setDaemon(true);
        return t;
    });

    private final ChatClient chatClient;
    private final AiUsageLogger usageLogger;
    private final AgentOrchestrator orchestrator;
    private final ChatMemoryService memoryService;
    private final UserMemoryService userMemoryService;
    private final UserMemoryExtractor userMemoryExtractor;
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
        this.userMemoryService = deps.userMemoryService();
        this.userMemoryExtractor = deps.userMemoryExtractor();
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
        Prepared p = prepare(userId, req);
        // P1-13 熔断：OPEN 窗口内快速失败（不调 LLM）。多级兜底第二级在此先试本地规则库，未命中才 502
        if (!circuitBreaker.allowCall()) {
            return fallbackOrThrow(p.anchored(), p.sessionId(), p.trace(), p.degradeAllowed(),
                    new BadGatewayException("AI 服务暂时不可用（熔断保护中）"));
        }
        try {
            AiChatVo vo = dispatch(p.type(), userId, p.anchored());
            circuitBreaker.onSuccess();
            traceRecorder.complete(p.trace(), vo);
            if (p.sessionId() != null) {
                persist(p.sessionId(), "assistant", vo.content(), p.agentLabel());
                // degraded 一并透传：专家层若已降级，绑定会话后不能把标记丢掉
                return new AiChatVo(vo.content(), vo.sources(), p.sessionId(),
                        vo.tokensIn(), vo.tokensOut(), vo.latencyMs(), vo.degraded());
            }
            return vo;
        } catch (BadGatewayException e) {
            circuitBreaker.onFailure();
            return fallbackOrThrow(p.anchored(), p.sessionId(), p.trace(), p.degradeAllowed(), e);
        }
    }

    /**
     * 整段 / 流式两条链路共享的入口前序（行为等价抽取，不改语义）：
     * 防越权 → 路由/复杂度 → 多轮锚定 → 会话解析 → 配额（429）→ 用户消息落库（F-8）→
     * 实验灰度 → Trace 入口埋点（T07）。熔断与 LLM 调用各链路自行处理。
     */
    private Prepared prepare(Integer userId, AiChatRequest req) {
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
        // F-6 多轮锚定：有 sessionId → 历史前插（COMPLEX 收紧至 5 条=上下文压缩）
        AiChatRequest anchored = anchor(userId, req, level);
        // F-8：dispatch 前先落用户消息（LLM 失败/502 时用户消息已提交）
        Integer sessionId = resolveSession(userId, req, type);
        // F-6 会话配额（ADR-018）：超限 429，与 502 语义区分
        if (!callQuota.tryAcquire(sessionId)) {
            throw new QuotaExceededException("本轮对话已达上限（" + callQuota.maxCalls() + " 次），请开新会话继续");
        }
        String agentLabel = agentOf(type, req);
        persist(sessionId, "user", lastUserMessage(req), agentLabel);
        // ADR-024 灰度：assignActive 为空 = 实验未运行 → 兜底开启；control = 明确划旧路径（只 502）
        String subject = subjectOf(userId, sessionId);
        Map<String, String> experiments = new LinkedHashMap<>();
        Optional<String> rollout = experimentService.assignActive(FALLBACK_ROLLOUT_EXPERIMENT, subject);
        rollout.ifPresent(v -> experiments.put(FALLBACK_ROLLOUT_EXPERIMENT, v));
        String variant = rollout.orElse(null);
        // degradeAllowed 只看兜底实验：上游失败后是否走规则库的唯一开关
        boolean degradeAllowed = variant == null || ExperimentService.TREATMENT.equals(variant);
        // 只在真的会走 librarian 的请求上评估 tool-calling 实验，避免指标混入无关流量
        if (type == AgentType.LIBRARIAN) {
            experimentService.assignActive(LibrarianAgent.TOOL_CALLING_EXPERIMENT, subject)
                    .ifPresent(v -> experiments.put(LibrarianAgent.TOOL_CALLING_EXPERIMENT, v));
        }
        // T07 Trace 入口埋点（含复杂度档位与多实验归属），dispatch 后 complete/fail
        AiEvalTrace trace = traceRecorder.begin(sessionId, type, req, anchored, level, variant,
                variant == null ? null : FALLBACK_ROLLOUT_EXPERIMENT, experiments);
        return new Prepared(userId, anchored, sessionId, type, trace, degradeAllowed, agentLabel);
    }

    /** 入口前序产物：两条链路（整段/流式）共享，避免配额/实验/Trace 口径分叉。 */
    private record Prepared(Integer userId, AiChatRequest anchored, Integer sessionId,
                            AgentType type, AiEvalTrace trace, boolean degradeAllowed,
                            String agentLabel) {
    }

    /**
     * 流式聊天（SSE，F-1）。与整段 {@link #chat} 共享入口前序（路由/锚定/配额/落用户消息/Trace），
     * LLM 走透明车道转发全部锚定消息（含前端 system prompt）逐 chunk 下发。
     *
     * <p>预流失败（越权 404 / 配额 429 / 无 key / 熔断未命中兜底）在建立 emitter 前以普通 HTTP
     * 状态抛出，前端据状态回退整段路径（承重墙 F-4）；熔断命中本地规则库则作为单 chunk 下发。</p>
     *
     * <p>边界（本期）：服务端专家人设注入（五专家 SYSTEM_PROMPT + RAG）仅在整段路径；
     * 流式端到端管道先打通，专家人设/工具流留待与 tool_calls 流事件一并集成。</p>
     */
    public SseEmitter chatStream(Integer userId, AiChatRequest req) {
        Prepared p = prepare(userId, req);
        // 透明车道 key 门禁（与 transparentChat 同规则）：预流同步失败 → 502
        String key = "openai".equals(modelChat) ? openaiApiKey : dashscopeApiKey;
        if (key == null || key.isBlank() || "disabled".equals(key)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }
        // 熔断：与整段同语义——命中规则库 → 单 chunk 下发；否则 502 让前端回退。
        // 放在建立主 emitter 之前：未命中兜底的预流失败以普通 HTTP 状态抛出（前端据状态回退整段路径）。
        if (!circuitBreaker.allowCall()) {
            BadGatewayException breaker = new BadGatewayException("AI 服务暂时不可用（熔断保护中）");
            traceRecorder.fail(p.trace(), breaker);
            if (p.degradeAllowed()) {
                Optional<String> rule = localFallbackService.answerFor(lastUserMessage(p.anchored()));
                if (rule.isPresent()) {
                    SseEmitter fallback = new SseEmitter(STREAM_TIMEOUT_MS);
                    persist(p.sessionId(), "assistant", rule.get(), "fallback");
                    try {
                        emitRuleAnswer(sink(fallback), p.sessionId(), rule.get());
                    } catch (Exception e) {
                        log.warn("send fallback stream frame failed: {}", e.getMessage());
                    }
                    fallback.complete();
                    return fallback;
                }
            }
            throw breaker;
        }
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        streamExecutor.execute(() -> runStream(emitter, p));
        return emitter;
    }

    /** SSE 帧出口（测试 seam）：正式写 SseEmitter；单测替换为 List 收集，免 MVC handler。 */
    @FunctionalInterface
    private interface FrameSink {
        void emit(String frame) throws Exception;
    }

    /** 包级可见测试 seam：非空时所有 SSE 帧写入这里（而非 SseEmitter），便于断言帧序列。 */
    List<String> testFrames;

    private FrameSink sink(SseEmitter emitter) {
        return frame -> {
            if (testFrames != null) {
                testFrames.add(frame);
            } else {
                emitter.send(SseEmitter.event().data(frame));
            }
        };
    }

    /** 流式 worker：逐 chunk 下发文本，结束时结算计量/Trace/会话落库。异常帧带 error 字段。 */
    private void runStream(SseEmitter emitter, Prepared p) {
        FrameSink sink = sink(emitter);
        List<Message> messages = toSpringMessages(p.anchored().messages());
        long start = System.currentTimeMillis();
        StringBuilder out = new StringBuilder();
        final ChatResponse[] last = new ChatResponse[1];
        try {
            chatClient.prompt().messages(messages).stream().chatResponse()
                    .doOnNext(resp -> {
                        last[0] = resp;
                        String text = chunkText(resp);
                        if (!text.isEmpty()) {
                            out.append(text);
                            try {
                                sink.emit("{\"d\":\"" + jsonEscape(text) + "\"}");
                            } catch (Exception e) {
                                // 客户端断连/写失败 → 终止流
                                throw new IllegalStateException(e);
                            }
                        }
                    })
                    .blockLast();
            String content = out.toString();
            if (content.isBlank()) {
                throw new BadGatewayException("AI 服务返回为空");
            }
            long latency = System.currentTimeMillis() - start;
            ChatResponse resp = last[0];
            Integer tokensIn = null;
            Integer tokensOut = null;
            if (resp != null && resp.getMetadata() != null && resp.getMetadata().getUsage() != null) {
                Usage usage = resp.getMetadata().getUsage();
                tokensIn = usage.getPromptTokens();
                tokensOut = usage.getCompletionTokens();
            }
            AiChatVo vo = new AiChatVo(content, null, p.sessionId(), tokensIn, tokensOut, (int) latency);
            // 计量旁路：失败不影响已下发的流
            try {
                usageLogger.save(p.userId(), p.anchored(), resp, (int) latency);
            } catch (Exception e) {
                log.warn("save usage log (stream) failed: {}", e.getMessage());
            }
            circuitBreaker.onSuccess();
            traceRecorder.complete(p.trace(), vo);
            if (p.sessionId() != null) {
                persist(p.sessionId(), "assistant", content, p.agentLabel());
            }
            emitMetaAndDone(sink, p.sessionId());
        } catch (Exception e) {
            circuitBreaker.onFailure();
            traceRecorder.fail(p.trace(), e instanceof BadGatewayException bg ? bg
                    : new BadGatewayException("AI 流式调用失败: " + e.getMessage()));
            try {
                sink.emit("{\"error\":\"BAD_GATEWAY\"}");
            } catch (Exception ignore) {
                // 客户端已断连，无需再通知
            }
        } finally {
            emitter.complete();
        }
    }

    /** 熔断命中规则库：单 chunk 兜底答复（delta + meta + DONE）。 */
    private static void emitRuleAnswer(FrameSink sink, Integer sessionId, String content) throws Exception {
        sink.emit("{\"d\":\"" + jsonEscape(content) + "\"}");
        emitMetaAndDone(sink, sessionId);
    }

    /** 结束帧：meta（sessionId 供前端续用）+ {@code data: [DONE]}（F-1）。 */
    private static void emitMetaAndDone(FrameSink sink, Integer sessionId) throws Exception {
        String meta = sessionId == null ? "{}" : "{\"sessionId\":" + sessionId + "}";
        sink.emit("{\"meta\":" + meta + "}");
        sink.emit("[DONE]");
    }

    /** chunk 文本提取：Spring AI 流式每个 chunk 可能只带增量文本或仅元数据/usage，空链返回空串（不抛）。 */
    private static String chunkText(ChatResponse resp) {
        var result = resp == null ? null : resp.getResult();
        var output = result == null ? null : result.getOutput();
        String text = output == null ? null : output.getText();
        return text == null ? "" : text;
    }

    /** 最小 JSON 字符串转义（SSE delta 手拼 JSON，避免引入 ObjectMapper 接线）。 */
    private static String jsonEscape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
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

    /**
     * 上下文前插（F-6 多轮锚定 + F-B2 跨会话画像）：
     * <ul>
     *   <li>新会话开场（登录且无 sessionId）：把 user_memory 提炼摘要作为 system 消息前插——
     *       只放合并摘要，不回灌原始对话；旧会话内不重复注入；</li>
     *   <li>已有会话（登录且有 sessionId）：历史 ≤20 条前插（归属已在 chat() 入口 requireSession 校验）。
     *       COMPLEX → 只取最后 5 条（上下文压缩，T09）。</li>
     * </ul>
     * 其余场景（游客/空历史）原样返回。
     */
    private AiChatRequest anchor(Integer userId, AiChatRequest req, ComplexityLevel level) {
        List<ChatMessageDto> prefix = new ArrayList<>();
        // F-B2 跨会话画像：新会话开场注入提炼摘要
        if (userId != null && req.sessionId() == null) {
            String memory = userMemoryService.summaryForPrompt(userId);
            if (memory != null && !memory.isBlank()) {
                prefix.add(new ChatMessageDto("system", memory));
            }
        }
        // F-6 多轮锚定：已有会话读历史
        if (userId != null && req.sessionId() != null) {
            List<AiChatMessage> history = memoryService.history(req.sessionId(), ANCHOR_LIMIT);
            if (history != null && !history.isEmpty()) {
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
        // F-B2 旧会话收尾：开新会话前 best-effort 抽取上一个会话的画像；失败仅 warn，不阻塞聊天承重墙
        extractPreviousSessionMemory(userId);
        try {
            return memoryService.createSession(userId, topicOf(req), agentOf(type, req)).getId();
        } catch (Exception e) {
            log.warn("create chat session failed: {}", e.getMessage());
            return null;
        }
    }

    /** 抽取用户最近一个会话（=刚结束的上一会话）的画像。无历史会话直接跳过。 */
    private void extractPreviousSessionMemory(Integer userId) {
        try {
            List<AiChatSession> recent = memoryService.sessions(userId);
            if (recent.isEmpty()) {
                return;
            }
            userMemoryExtractor.extractFromSession(userId, recent.get(0).getId());
        } catch (Exception e) {
            log.warn("extract previous session memory failed: {}", e.getMessage());
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
