package com.tea.telemetry.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 批量上报请求体（契约 §2，camelCase 与前端一致）。
 * 故意不用 Bean Validation 注解：①条数上限来自配置（TelemetryProperties.maxEventsPerRequest），
 * 注解无法读配置；②契约 §4 要求逐条校验、单条非法只计 rejected，而 @Valid 会让整批 400。
 * 因此整个信封的校验在 TelemetryIngestService 里显式做，抛出 BadRequestException。
 */
public record TelemetryBatchRequest(
        UUID clientId,
        UUID sessionId,
        String appVersion,
        Instant sentAt,
        List<TelemetryEvent> events) {
}
