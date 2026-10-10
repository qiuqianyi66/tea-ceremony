package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/**
 * 会话配额超限（429，复用 RATE_LIMITED 错误码）。
 * 与 BadGatewayException（上游 LLM 不可用）语义区分：前者是「本会话聊太多」，
 * 后者是「AI 服务挂了」。前端 teaAI.ts 对两者都走规则降级，但语义必须分清楚。
 */
public class QuotaExceededException extends BusinessException {

    public QuotaExceededException(String message) {
        super(ErrorCode.RATE_LIMITED, message);
    }
}
