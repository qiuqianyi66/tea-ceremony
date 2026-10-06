package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/**
 * 502 Bad Gateway：上游 LLM 不可用（无 key 占位 / 上游超时 / 5xx）。
 * 前端 teaAI.ts 据此状态码降级规则引擎（旧契约语义，承重墙）。
 */
public class BadGatewayException extends BusinessException {

    public BadGatewayException(String message) {
        super(ErrorCode.BAD_GATEWAY, message);
    }
}
