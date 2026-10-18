package com.tea.telemetry.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 指纹审批状态（契约 §1 PATCH reviews）。
 * 状态机：pending → acknowledged | ignored；acknowledged → resolved。
 * 流转规则由 ErrorFingerprintService 实现（非法流转抛 ConflictException）。
 */
public enum ReviewStatus {

    PENDING("pending"),
    ACKNOWLEDGED("acknowledged"),
    IGNORED("ignored"),
    RESOLVED("resolved");

    private final String value;

    ReviewStatus(String value) {
        this.value = value;
    }

    /** 传输与存储统一用小写（V8 迁移默认 'pending'），与契约字面量一致。 */
    @JsonValue
    public String value() {
        return value;
    }

    /** 未知值返回 null：交给请求体 @NotNull 判 400，而不是抛 Jackson 异常变 500。 */
    @JsonCreator
    public static ReviewStatus from(String raw) {
        for (ReviewStatus status : values()) {
            if (status.value.equals(raw)) {
                return status;
            }
        }
        return null;
    }
}
