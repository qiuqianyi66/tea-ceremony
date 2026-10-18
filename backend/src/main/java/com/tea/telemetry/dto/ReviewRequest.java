package com.tea.telemetry.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 指纹审批请求（PATCH /api/v1/telemetry/fingerprints/{id}/review）。
 * status 必填；note 可空（忽略/解决时留原因便于回溯）。reviewed_by 不在请求体里——
 * 审批人取自 JWT 登录主体，客户端无法伪造。
 */
public record ReviewRequest(
        @NotNull(message = "status 必填")
        ReviewStatus status,

        @Size(max = 2000, message = "note 过长")
        String note) {
}
