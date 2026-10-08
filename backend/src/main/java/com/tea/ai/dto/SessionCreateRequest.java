package com.tea.ai.dto;

import jakarta.validation.constraints.Size;

/**
 * 创建 AI 会话请求（F-1）。topic/agent 均可空（topic 缺省由 Service 取首条用户消息前 100 字，决策 D-3/O-6）。
 */
public record SessionCreateRequest(
        @Size(max = 100, message = "topic 不超过 100 字符") String topic,
        @Size(max = 50, message = "agent 不超过 50 字符") String agent) {
}
