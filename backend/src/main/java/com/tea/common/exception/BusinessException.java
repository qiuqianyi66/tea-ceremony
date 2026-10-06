package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;
import lombok.Getter;

/**
 * 业务异常基类（红线 #2：统一继承体系，禁裸抛 RuntimeException）。
 * 业务预期失败由全局异常处理器转 ApiResponse，日志 warn。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
