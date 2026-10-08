package com.tea.ai.service;

import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.repository.AiChatMessageRepository;
import com.tea.ai.repository.AiChatSessionRepository;
import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 会话记忆（M5-S2，ai_chat_sessions/ai_messages）。
 * 登录用户专属：游客不落会话（V3 注释）；归属校验走 findByIdAndUserId（防越权）。
 * 删除会话由 DB FK ON DELETE CASCADE 级联清消息（用户删除控制权）。
 */
@Service
@RequiredArgsConstructor
public class ChatMemoryService {

    private static final int MAX_HISTORY = 100;

    private final AiChatSessionRepository sessionRepository;
    private final AiChatMessageRepository messageRepository;

    @Transactional
    public AiChatSession createSession(Integer userId, String topic, String agent) {
        if (userId == null) {
            throw new BadRequestException("游客不落会话");
        }
        AiChatSession session = new AiChatSession();
        session.setUserId(userId);
        session.setTopic(topic);
        session.setAgent(agent);
        return sessionRepository.save(session);
    }

    @Transactional
    public void appendMessage(Integer sessionId, String role, String content, String agent, Integer tokens) {
        AiChatMessage message = new AiChatMessage();
        message.setSessionId(sessionId);
        message.setRole(role);
        message.setContent(content);
        message.setAgent(agent);
        message.setTokens(tokens);
        messageRepository.save(message);
    }

    /** 最近 limit 条历史（正序返回，供 prompt 上下文回填）。 */
    @Transactional(readOnly = true)
    public List<AiChatMessage> history(Integer sessionId, int limit) {
        if (limit < 1 || limit > MAX_HISTORY) {
            throw new BadRequestException("limit 必须在 1-100 之间");
        }
        List<AiChatMessage> recentDesc = messageRepository.findBySessionIdOrderByIdDesc(
                sessionId, PageRequest.of(0, limit));
        // 防御性拷贝：不原地反转入参（repo 返回可能为不可变列表）
        List<AiChatMessage> ascending = new ArrayList<>(recentDesc);
        Collections.reverse(ascending);
        return ascending;
    }

    /** 归属校验：会话不存在或非本人 → 404（防越权；AiChatService 在落库前调用）。 */
    @Transactional(readOnly = true)
    public AiChatSession requireSession(Integer userId, Integer sessionId) {
        return sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("会话不存在"));
    }

    @Transactional(readOnly = true)
    public List<AiChatSession> sessions(Integer userId) {
        return sessionRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional
    public void deleteSession(Integer userId, Integer sessionId) {
        AiChatSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new NotFoundException("会话不存在"));
        sessionRepository.delete(session);
    }
}
