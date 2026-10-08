package com.tea.ai.vo;

import java.util.List;

/**
 * AI 聊天响应（M5-S1 契约：content + sources；M5-S2 加 sessionId）。
 * sources：知识来源（茶/人/产区/诗名）；透明代理/未命中时为 null（前端兼容：无引用卡片）。
 * sessionId：登录用户会话记忆返回；游客/续写失败时为 null（前端兼容：无记忆）。
 */
public record AiChatVo(String content, List<String> sources, Integer sessionId) {

    /** 兼容旧调用（无会话记忆）。 */
    public AiChatVo(String content, List<String> sources) {
        this(content, sources, null);
    }
}
