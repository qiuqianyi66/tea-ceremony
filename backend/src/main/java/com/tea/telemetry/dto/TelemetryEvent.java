package com.tea.telemetry.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;

/**
 * 单条事件（契约 §2）。
 * payload 保持 JsonNode 不直接映射成两种强类型：type 非法时若用 @JsonTypeInfo，
 * Jackson 会在反序列化整个请求时抛异常，导致一批全部 400，违反契约 §4「单条非法不中断整批」。
 * 由 Service 按 type 分派到 {@link ErrorPayload} / {@link VitalPayload}，转换失败只计 rejected。
 */
public record TelemetryEvent(
        UUID clientEventId,
        String type,
        Instant occurredAt,
        String route,
        JsonNode payload) {

    public static final String TYPE_ERROR = "error";
    public static final String TYPE_VITAL = "vital";
}
