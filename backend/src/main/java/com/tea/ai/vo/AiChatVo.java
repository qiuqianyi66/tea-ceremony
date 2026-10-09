package com.tea.ai.vo;

import java.util.List;

/**
 * AI 聊天响应（M5-S1 契约：content + sources；M5-S2 加 sessionId；T07 加评测旁路 tokens/latency）。
 * sources：知识来源（茶/人/产区/诗名）；透明代理/未命中时为 null（前端兼容：无引用卡片）。
 * sessionId：登录用户会话记忆返回；游客/续写失败时为 null（前端兼容：无记忆）。
 * tokensIn/tokensOut/latencyMs：评测旁路（T07 Trace 用；null 时前端不感知，jackson non_null）。
 */
public record AiChatVo(String content, List<String> sources, Integer sessionId,
                       Integer tokensIn, Integer tokensOut, Integer latencyMs) {

    /** 兼容旧调用（无会话记忆）。 */
    public AiChatVo(String content, List<String> sources) {
        this(content, sources, null, null, null, null);
    }

    /** 兼容旧调用（有会话记忆）。 */
    public AiChatVo(String content, List<String> sources, Integer sessionId) {
        this(content, sources, sessionId, null, null, null);
    }
}
