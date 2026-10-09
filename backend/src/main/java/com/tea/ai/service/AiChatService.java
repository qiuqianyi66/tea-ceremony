package com.tea.ai.service;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
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
    private final String apiKey;

    public AiChatService(ChatClient.Builder chatClientBuilder,
                         AiUsageLogger usageLogger,
                         AgentOrchestrator orchestrator,
                         ChatMemoryService memoryService,
                         TraceRecorder traceRecorder,
                         LibrarianAgent librarianAgent,
                         AdvisorAgent advisorAgent,
                         TasterAgent tasterAgent,
                         BrewerAgent brewerAgent,
                         MentorAgent mentorAgent,
                         @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        this.chatClient = chatClientBuilder.build();
        this.usageLogger = usageLogger;
        this.orchestrator = orchestrator;
        this.memoryService = memoryService;
        this.traceRecorder = traceRecorder;
        this.librarianAgent = librarianAgent;
        this.advisorAgent = advisorAgent;
        this.tasterAgent = tasterAgent;
        this.brewerAgent = brewerAgent;
        this.mentorAgent = mentorAgent;
        this.apiKey = apiKey;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        // 防越权前置：带 sessionId 且登录 → 归属校验先行（非本人 404，不浪费 LLM 调用）
        if (userId != null && req.sessionId() != null) {
            memoryService.requireSession(userId, req.sessionId());
        }
        AgentType type = orchestrator.routeToAgent(req);
        // F-6 多轮锚定（278 Save Plan）：有 sessionId → 历史（≤20）前插进请求 messages
        AiChatRequest anchored = anchor(userId, req);
        // F-8 降级不丢用户消息：dispatch 前先落库（LLM 失败/502 时用户消息已提交，响应仍走既有降级抛出路径）
        Integer sessionId = resolveSession(userId, req, type);
        persist(sessionId, "user", lastUserMessage(req), agentOf(type, req));
        // T07 评测 Trace：入口埋点（input/context/plan 层），dispatch 后 complete/fail（ADR-016）
        AiEvalTrace trace = traceRecorder.begin(sessionId, type, req, anchored);
        try {
            AiChatVo vo = dispatch(type, userId, anchored);
            traceRecorder.complete(trace, vo);
            if (sessionId != null) {
                persist(sessionId, "assistant", vo.content(), agentOf(type, req));
                return new AiChatVo(vo.content(), vo.sources(), sessionId, vo.tokensIn(), vo.tokensOut(), vo.latencyMs());
            }
            return vo;
        } catch (BadGatewayException e) {
            traceRecorder.fail(trace, e);
            throw e;
        }
    }

    /** F-6 多轮锚定：登录 + 有 sessionId → 读历史（归属已校验）转 ChatMessageDto 前插；其余原样返回。 */
    private AiChatRequest anchor(Integer userId, AiChatRequest req) {
        if (userId == null || req.sessionId() == null) {
            return req;
        }
        List<AiChatMessage> history = memoryService.anchorHistory(userId, req.sessionId());
        if (history == null || history.isEmpty()) {
            return req;
        }
        List<ChatMessageDto> prefix = new ArrayList<>();
        for (AiChatMessage m : history) {
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

    /** 五专家派发；null/CHAT 回落透明代理。 */
    private AiChatVo dispatch(AgentType type, Integer userId, AiChatRequest req) {
        if (type == AgentType.LIBRARIAN) {
            return librarianAgent.chat(userId, req);
        }
        if (type == AgentType.ADVISOR) {
            return advisorAgent.chat(userId, req);
        }
        if (type == AgentType.TASTER) {
            return tasterAgent.chat(userId, req);
        }
        if (type == AgentType.BREWER) {
            return brewerAgent.chat(userId, req);
        }
        if (type == AgentType.MENTOR) {
            return mentorAgent.chat(userId, req);
        }
        return transparentChat(userId, req);
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

    /** 透明代理（type == null 或 CHAT；T11 行为不变）。 */
    private AiChatVo transparentChat(Integer userId, AiChatRequest req) {
        if (apiKey == null || apiKey.isBlank() || "disabled".equals(apiKey)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }

        List<Message> messages = toSpringMessages(req.messages());
        long start = System.currentTimeMillis();
        ChatResponse response;
        try {
            response = chatClient.prompt().messages(messages).call().chatResponse();
        } catch (Exception e) {
            log.warn("LLM call failed: {}", e.getMessage());
            throw new BadGatewayException("AI 服务调用失败");
        }
        int latency = (int) (System.currentTimeMillis() - start);

        String content = response.getResult().getOutput().getText();
        if (content == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }

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
