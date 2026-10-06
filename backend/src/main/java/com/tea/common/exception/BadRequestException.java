package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/** 参数/业务校验失败（400）。 */
public class BadRequestException extends BusinessException {

    public BadRequestException() {
        super(ErrorCode.PARAM_INVALID);
    }

    public BadRequestException(String message) {
        super(ErrorCode.PARAM_INVALID, message);
    }
}
