package com.tea.telemetry.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.exception.BadRequestException;
import com.tea.telemetry.config.TelemetryProperties;
import com.tea.telemetry.dto.ErrorPayload;
import com.tea.telemetry.dto.TelemetryBatchRequest;
import com.tea.telemetry.dto.TelemetryBatchResult;
import com.tea.telemetry.dto.VitalPayload;
import com.tea.telemetry.entity.TelemetryEvent;
import com.tea.telemetry.repository.ErrorFingerprintRepository;
import com.tea.telemetry.repository.TelemetryEventRepository;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 遥测批量入库（契约 §4/§9）。
 *
 * 三条硬规则：
 * 1. 只有信封非法（缺 clientId / events 非数组 / 超条数上限）才整体 400；
 * 2. 单条事件任何校验失败只累加 rejected，不抛异常中断整批——前端一次批量里混着坏数据是常态；
 * 3. 幂等靠 client_event_id 唯一键 + ON CONFLICT DO NOTHING，重复上报计 duplicated 且不累加计数。
 *
 * 事件实体与 DTO 同名（契约里都叫 TelemetryEvent），本类 import 实体、DTO 用全限定名区分。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryIngestService {

    /** 列宽上限即契约长度上限（§3.1）：超长按契约 §4 计入 rejected，不做静默截断。 */
    private static final int MAX_MESSAGE = 500;
    private static final int MAX_STACK = 4000;
    private static final int MAX_SOURCE = 256;
    private static final int MAX_ROUTE = 128;
    private static final int MAX_APP_VERSION = 32;
    private static final int MAX_RATING = 24;

    private final TelemetryEventRepository eventRepository;
    private final ErrorFingerprintRepository fingerprintRepository;
    private final TelemetrySanitizer sanitizer;
    private final FingerprintService fingerprintService;
    private final TelemetryProperties props;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public TelemetryBatchResult ingest(TelemetryBatchRequest request) {
        validateEnvelope(request);
        LocalDateTime receivedAt = LocalDateTime.now();
        int accepted = 0;
        int duplicated = 0;
        int rejected = 0;
        for (com.tea.telemetry.dto.TelemetryEvent event : request.events()) {
            Optional<TelemetryEvent> row = toRow(event, request, receivedAt);
            if (row.isEmpty()) {
                rejected++;
                continue;
            }
            TelemetryEvent saved = row.get();
            int inserted = eventRepository.insertIfAbsent(
                    saved.getClientEventId(), saved.getClientId(), saved.getSessionId(), saved.getAppVersion(),
                    saved.getEventType(), saved.getRoute(), saved.getFingerprint(), saved.getMessage(),
                    saved.getStack(), saved.getSourceFile(), saved.getLineNo(), saved.getColNo(),
                    saved.getMetricName(), saved.getMetricValue(), saved.getMetricRating(), saved.getOccurredAt());
            if (inserted == 0) {
                duplicated++;
                continue;
            }
            accepted++;
            if (com.tea.telemetry.dto.TelemetryEvent.TYPE_ERROR.equals(saved.getEventType())) {
                upsertFingerprint(saved);
            }
        }
        return new TelemetryBatchResult(accepted, duplicated, rejected);
    }

    /** 信封校验：契约 §4 唯一允许整体 400 的三种情况。 */
    private void validateEnvelope(TelemetryBatchRequest request) {
        if (request == null || request.clientId() == null) {
            throw new BadRequestException("clientId 缺失");
        }
        if (request.sessionId() == null) {
            throw new BadRequestException("sessionId 缺失");
        }
        if (request.events() == null) {
            throw new BadRequestException("events 必须为数组");
        }
        int max = props.getMaxEventsPerRequest();
        if (request.events().size() > max) {
            throw new BadRequestException("events 超过单请求上限 " + max + " 条");
        }
    }

    /**
     * 单条事件 → 实体。返回 empty 表示该条非法（计入 rejected）。
     * 校验顺序：必填 → 长度 → payload 形态 → 业务字段，先便宜后昂贵。
     */
    private Optional<TelemetryEvent> toRow(com.tea.telemetry.dto.TelemetryEvent event,
                                          TelemetryBatchRequest request,
                                          LocalDateTime receivedAt) {
        if (event == null || event.clientEventId() == null || event.type() == null || event.occurredAt() == null) {
            return Optional.empty();
        }
        if (event.route() != null && event.route().length() > MAX_ROUTE) {
            return Optional.empty();
        }
        if (request.appVersion() != null && request.appVersion().length() > MAX_APP_VERSION) {
            return Optional.empty();
        }
        TelemetryEvent row = new TelemetryEvent();
        row.setClientEventId(event.clientEventId());
        row.setClientId(request.clientId());
        row.setSessionId(request.sessionId());
        row.setAppVersion(request.appVersion());
        row.setEventType(event.type());
        row.setRoute(sanitizer.sanitize(event.route(), MAX_ROUTE));
        row.setOccurredAt(LocalDateTime.ofInstant(event.occurredAt(), ZoneId.systemDefault()));
        row.setReceivedAt(receivedAt);
        return switch (event.type()) {
            case com.tea.telemetry.dto.TelemetryEvent.TYPE_ERROR -> fillError(row, event.payload());
            case com.tea.telemetry.dto.TelemetryEvent.TYPE_VITAL -> fillVital(row, event.payload());
            default -> Optional.empty();
        };
    }

    private Optional<TelemetryEvent> fillError(TelemetryEvent row, JsonNode node) {
        ErrorPayload payload = payload(node, ErrorPayload.class);
        if (payload == null || payload.message() == null || payload.message().isBlank()) {
            return Optional.empty();
        }
        if (payload.message().length() > MAX_MESSAGE
                || (payload.stack() != null && payload.stack().length() > MAX_STACK)
                || (payload.source() != null && payload.source().length() > MAX_SOURCE)) {
            return Optional.empty();
        }
        String message = sanitizer.sanitize(payload.message(), MAX_MESSAGE);
        String stack = sanitizer.sanitize(payload.stack(), MAX_STACK);
        // source 只留 pathname（契约 §3.1）：query 里可能有 token；同时保证与前端指纹输入的 source 同形
        String source = fingerprintService.pathname(sanitizer.sanitize(payload.source(), MAX_SOURCE));
        String fingerprint = fingerprintService.isValidFingerprint(payload.fingerprint())
                ? payload.fingerprint()
                : fingerprintService.compute(payload.kind(), source, message, payload.lineno());
        row.setMessage(message);
        row.setStack(stack);
        row.setSourceFile(source.isEmpty() ? null : source);
        row.setLineNo(payload.lineno());
        row.setColNo(payload.colno());
        row.setFingerprint(fingerprint);
        return Optional.of(row);
    }

    private Optional<TelemetryEvent> fillVital(TelemetryEvent row, JsonNode node) {
        VitalPayload payload = payload(node, VitalPayload.class);
        if (payload == null || payload.name() == null) {
            return Optional.empty();
        }
        TelemetryProperties.Metric metric = props.metric(payload.name());
        if (metric == null) {
            return Optional.empty();
        }
        Double value = payload.value();
        if (value == null || value.isNaN() || value.isInfinite() || value < 0) {
            return Optional.empty();
        }
        row.setMetricName(metric.getName());
        row.setMetricValue(value);
        row.setMetricRating(TelemetrySanitizer.truncate(payload.rating(), MAX_RATING));
        return Optional.of(row);
    }

    /** payload 转换失败只影响本条（返回 null → rejected），异常不冒泡到整批。 */
    private <T> T payload(JsonNode node, Class<T> type) {
        if (node == null || node.isNull()) {
            return null;
        }
        try {
            return objectMapper.treeToValue(node, type);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            log.warn("telemetry payload 解析失败，本条计 rejected: type={}, reason={}",
                    type.getSimpleName(), ex.getMessage());
            return null;
        }
    }

    /**
     * error 事件同步 upsert 指纹（契约 §9）：occurrences +1、刷新 last_seen_at；
     * 首次插入 review_status 由 SQL 固定为 pending（Human-in-the-Loop 待审批）。
     * first/last 都传事件发生时间而不是服务端时间：客户端离线补传时先后顺序有意义。
     */
    private void upsertFingerprint(TelemetryEvent row) {
        fingerprintRepository.upsertOnError(row.getFingerprint(), row.getMessage(), row.getStack(),
                row.getRoute(), row.getOccurredAt(), row.getOccurredAt());
    }
}
