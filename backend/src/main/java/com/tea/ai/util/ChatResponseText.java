package com.tea.ai.util;

import com.tea.common.exception.BadGatewayException;
import org.springframework.ai.chat.model.ChatResponse;

/**
 * LLM 回复正文安全提取：Spring AI 的 ChatResponse 链路（getResult / getOutput / getText）在
 * 上游异常、被风控拦截或模型返回空 completion 时，任一节点都可能为 null 或空白串。
 * 旧代码直接 {@code response.getResult().getOutput().getText()} 在中间节点为 null 时抛 NPE → 500，
 * 而空白正文则被当成正常响应返回 200 空体，前端静默降级且计量误判为成功调用。
 * 这里统一：链路任一节点为 null，或正文为 null/blank → 抛 BadGatewayException（502），
 * 与既有 {@code content == null} 分支的语义一致，让上游失败一律走 502 → 前端降级规则引擎。
 */
public final class ChatResponseText {

    private ChatResponseText() {
    }

    public static String requireNonBlank(ChatResponse response) {
        if (response == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        var result = response.getResult();
        if (result == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        var output = result.getOutput();
        if (output == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        String text = output.getText();
        if (text == null || text.isBlank()) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        return text;
    }
}
