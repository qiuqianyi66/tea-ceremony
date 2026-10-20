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
 *
 * <p>复杂度：时间 O(1)——仅对响应对象做固定层数（response→result→output→text）的空链判定，
 * 无循环、无递归，不随输入规模增长；唯一线性扫描是 text.isBlank() 对回复正文本身（长度有界），
 * 且每条请求仅一次，与是否抽取正文无关。圈复杂度 1：空链判定收敛为「剥洋葱」三元链，末尾一个 if 判空白。</p>
 */
public final class ChatResponseText {

    private ChatResponseText() {
    }

    public static String requireNonBlank(ChatResponse response) {
        // 固定链路的空判定：任一节点为 null → 上游失败 → 502
        var result = response == null ? null : response.getResult();
        var output = result == null ? null : result.getOutput();
        String text = output == null ? null : output.getText();
        if (text == null || text.isBlank()) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        return text;
    }
}
