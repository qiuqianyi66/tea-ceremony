package com.tea.common.errorcode;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 全局错误码表（稳定、可查、不随文案变化；编码规范 §15）。
 * 目录 common/error-code/ 对应包名 errorcode（Java 包名禁连字符）。
 */
@Getter
public enum ErrorCode {

    SYSTEM_ERROR("SYSTEM_ERROR", HttpStatus.INTERNAL_SERVER_ERROR, "系统繁忙，请稍后重试"),
    PARAM_INVALID("PARAM_INVALID", HttpStatus.BAD_REQUEST, "参数校验失败"),
    UNAUTHORIZED("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, "未登录或登录已过期"),
    FORBIDDEN("FORBIDDEN", HttpStatus.FORBIDDEN, "无权限访问"),
    NOT_FOUND("NOT_FOUND", HttpStatus.NOT_FOUND, "资源不存在"),
    CONFLICT("CONFLICT", HttpStatus.CONFLICT, "资源状态冲突"),
    METHOD_NOT_ALLOWED("METHOD_NOT_ALLOWED", HttpStatus.METHOD_NOT_ALLOWED, "请求方法不支持");

    private final String code;
    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(String code, HttpStatus httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
