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
import com.tea.ai.entity.AiChatSession;
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
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * AI 聊天服务（M5-S2：五专家派发 + 透明代理回落 + 会话记忆旁路）。
 * 承重墙：key 不可用/上游失败 → 502（前端 teaAI.ts 降级规则引擎）；仅成功调用落计量。
 * 路由：AgentOrchestrator 判定专家类型；null/CHAT 回落透明代理（T11 行为不变）。
 * 记忆旁路：登录用户 + 响应成功后落库（user+assistant）；落库失败不影响 AI 响应（同计量旁路）。
 * 防越权：带 sessionId 时先 requireSession（非本人 → 404 显式失败）。
 */
@Slf4j
@Service
public class AiChatService {

    private final ChatClient chatClient;
    private final AiUsageLogger usageLogger;
    private final AgentOrchestrator orchestrator;
    private final ChatMemoryService memoryService;
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
        AiChatVo vo = dispatch(type, userId, req);
        return remember(userId, req, type, vo);
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

    /**
     * 会话记忆旁路（M5-S2）：登录用户 + 成功响应后落库。
     * 游客不落；sessionId 归属已在 chat() 前置校验（此处直接续写）；
     * 落库异常仅 warn，不影响已成功的 AI 响应（承重墙不变量）。
     */
    private AiChatVo remember(Integer userId, AiChatRequest req, AgentType type, AiChatVo vo) {
        if (userId == null) {
            return vo;
        }
        try {
            Integer sessionId = req.sessionId();
            if (sessionId == null) {
                sessionId = memoryService.createSession(userId, topicOf(req), agentOf(type, req)).getId();
            }
            String agent = agentOf(type, req);
            memoryService.appendMessage(sessionId, "user", lastUserMessage(req), agent, null);
            memoryService.appendMessage(sessionId, "assistant", vo.content(), agent, null);
            return new AiChatVo(vo.content(), vo.sources(), sessionId);
        } catch (Exception e) {
            log.warn("save chat memory failed: {}", e.getMessage());
            return vo;
        }
    }

    private String agentOf(AgentType type, AiChatRequest req) {
        return req.agent() != null ? req.agent() : type.name().toLowerCase();
    }

    /** 会话标题：最后一条用户消息前 100 字（空 → 空串）。 */
    private String topicOf(AiChatRequest req) {
        String last = lastUserMessage(req);
        return last.length() > 100 ? last.substring(0, 100) : last;
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
        return new AiChatVo(content, null);
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
