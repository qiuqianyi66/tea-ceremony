package com.tea.ai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * AI 聊天请求（透明代理：messages 原样转发，前端控制 system prompt）。
 * agent 可选——用于 ai_usage_logs 计量归类，缺省 chat。
 * sessionId 可选（M5-S2 会话记忆）：带值=续写会话（非本人 → 404）；缺省=登录用户开新会话，游客不落库。
 */
public record AiChatRequest(
        @NotEmpty(message = "messages 不能为空")
                @Size(max = 20, message = "messages 不超过 20 条")
                List<@Valid ChatMessageDto> messages,
        @Size(max = 50, message = "agent 不超过 50 字符") String agent,
        @Min(value = 1, message = "sessionId 必须为正整数") Integer sessionId) {

    /** 兼容旧调用（无会话记忆）。 */
    public AiChatRequest(List<ChatMessageDto> messages, String agent) {
        this(messages, agent, null);
    }
}
