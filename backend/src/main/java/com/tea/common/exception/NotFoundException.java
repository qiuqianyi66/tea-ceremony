package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/** 资源不存在（404）。 */
public class NotFoundException extends BusinessException {

    public NotFoundException() {
        super(ErrorCode.NOT_FOUND);
    }

    public NotFoundException(String message) {
        super(ErrorCode.NOT_FOUND, message);
    }
}
