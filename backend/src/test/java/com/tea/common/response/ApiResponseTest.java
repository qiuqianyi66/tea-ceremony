package com.tea.common.response;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.common.errorcode.ErrorCode;
import org.junit.jupiter.api.Test;

class ApiResponseTest {

    @Test
    void successReturnsOkCode() {
        ApiResponse<String> response = ApiResponse.success("data");
        assertThat(response.getCode()).isEqualTo("OK");
        assertThat(response.getData()).isEqualTo("data");
    }

    @Test
    void successWithoutDataKeepsNullData() {
        ApiResponse<Void> response = ApiResponse.success();
        assertThat(response.getCode()).isEqualTo("OK");
        assertThat(response.getData()).isNull();
    }

    @Test
    void errorUsesErrorCodeAndDefaultMessage() {
        ApiResponse<Void> response = ApiResponse.error(ErrorCode.NOT_FOUND);
        assertThat(response.getCode()).isEqualTo("NOT_FOUND");
        assertThat(response.getMessage()).isEqualTo("资源不存在");
        assertThat(response.getData()).isNull();
    }

    @Test
    void errorOverridesMessage() {
        ApiResponse<Void> response = ApiResponse.error(ErrorCode.CONFLICT, "品鉴记录重复提交");
        assertThat(response.getCode()).isEqualTo("CONFLICT");
        assertThat(response.getMessage()).isEqualTo("品鉴记录重复提交");
    }
}
