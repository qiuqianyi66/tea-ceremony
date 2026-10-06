package com.tea.ai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * AI 聊天请求（透明代理：messages 原样转发，前端控制 system prompt）。
 * agent 可选——用于 ai_usage_logs 计量归类，缺省 chat。
 */
public record AiChatRequest(
        @NotEmpty(message = "messages 不能为空")
                @Size(max = 20, message = "messages 不超过 20 条")
                List<@Valid ChatMessageDto> messages,
        @Size(max = 50, message = "agent 不超过 50 字符") String agent) {
}
