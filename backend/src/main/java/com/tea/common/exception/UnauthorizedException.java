package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/** 未登录/登录过期（401）。 */
public class UnauthorizedException extends BusinessException {

    public UnauthorizedException() {
        super(ErrorCode.UNAUTHORIZED);
    }

    public UnauthorizedException(String message) {
        super(ErrorCode.UNAUTHORIZED, message);
    }
}
