package com.tea.ai.vo;

import java.util.List;

/**
 * AI 聊天响应（M5-S1 契约：content + sources）。
 * sources：知识来源（茶/人/产区/诗名）；透明代理/未命中时为 null（前端兼容：无引用卡片）。
 */
public record AiChatVo(String content, List<String> sources) {
}
