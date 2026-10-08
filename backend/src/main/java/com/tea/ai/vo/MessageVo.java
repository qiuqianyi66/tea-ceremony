package com.tea.ai.vo;

import com.tea.ai.entity.AiChatMessage;
import java.time.LocalDateTime;

/**
 * AI 会话消息 VO（camelCase，与 AiChatVo 同风格；Entity 禁止出参）。
 * 历史消息端点响应（F-3）。
 */
public record MessageVo(
        Integer id,
        String role,
        String content,
        String agent,
        Integer tokens,
        LocalDateTime createdAt) {

    public static MessageVo from(AiChatMessage message) {
        return new MessageVo(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getAgent(),
                message.getTokens(),
                message.getCreatedAt());
    }
}
