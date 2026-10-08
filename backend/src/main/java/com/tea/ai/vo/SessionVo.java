package com.tea.ai.vo;

import com.tea.ai.entity.AiChatSession;
import java.time.LocalDateTime;

/**
 * AI 会话头 VO（camelCase，与 AiChatVo 同风格；Entity 禁止出参）。
 * 会话列表/创建响应（F-1/F-2）。
 */
public record SessionVo(
        Integer id,
        String topic,
        String agent,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static SessionVo from(AiChatSession session) {
        return new SessionVo(
                session.getId(),
                session.getTopic(),
                session.getAgent(),
                session.getCreatedAt(),
                session.getUpdatedAt());
    }
}
