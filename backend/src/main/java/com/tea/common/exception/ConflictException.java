package com.tea.common.exception;

import com.tea.common.errorcode.ErrorCode;

/** 资源状态冲突（409，如幂等冲突）。 */
public class ConflictException extends BusinessException {

    public ConflictException() {
        super(ErrorCode.CONFLICT);
    }

    public ConflictException(String message) {
        super(ErrorCode.CONFLICT, message);
    }
}
