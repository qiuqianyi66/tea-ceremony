package com.tea.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.common.errorcode.ErrorCode;
import org.junit.jupiter.api.Test;

class BusinessExceptionTest {

    @Test
    void badRequestCarriesParamInvalidCode() {
        BadRequestException ex = new BadRequestException("茶类不合法");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PARAM_INVALID);
        assertThat(ex.getMessage()).isEqualTo("茶类不合法");
    }

    @Test
    void notFoundCarriesNotFoundCodeAndDefaultMessage() {
        NotFoundException ex = new NotFoundException();
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(ex.getMessage()).isEqualTo("资源不存在");
    }

    @Test
    void unauthorizedCarries401Code() {
        UnauthorizedException ex = new UnauthorizedException();
        assertThat(ex.getErrorCode().getHttpStatus().value()).isEqualTo(401);
    }

    @Test
    void conflictCarries409Code() {
        ConflictException ex = new ConflictException("幂等冲突");
        assertThat(ex.getErrorCode().getHttpStatus().value()).isEqualTo(409);
    }
}
