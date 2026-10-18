package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.exception.BadRequestException;
import com.tea.telemetry.config.TelemetryProperties;
import com.tea.telemetry.dto.TelemetryBatchRequest;
import com.tea.telemetry.dto.TelemetryBatchResult;
import com.tea.telemetry.repository.ErrorFingerprintRepository;
import com.tea.telemetry.repository.TelemetryEventRepository;
import com.tea.telemetry.service.FingerprintService;
import com.tea.telemetry.service.TelemetryIngestService;
import com.tea.telemetry.service.TelemetrySanitizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 批量入库三条硬规则（契约 §4/§9）：幂等、单条非法不中断整批、error 事件 upsert 指纹。
 * Repository 是跨进程边界（DB 驱动），按测试规范允许 mock；其余协作者（脱敏、指纹）用真实实现，
 * 否则「指纹算错」这类缺陷会被 mock 掩盖。
 */
@ExtendWith(MockitoExtension.class)
class TelemetryIngestServiceTest {

    @Mock
    private TelemetryEventRepository eventRepository;

    @Mock
    private ErrorFingerprintRepository fingerprintRepository;

    private TelemetryIngestService service;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID clientId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TelemetryIngestService(eventRepository, fingerprintRepository,
                new TelemetrySanitizer(), new FingerprintService(), new TelemetryProperties(), objectMapper);
    }

    private TelemetryBatchRequest batch(com.tea.telemetry.dto.TelemetryEvent... events) {
        return new TelemetryBatchRequest(clientId, sessionId, "2.0.0", Instant.now(),
                new ArrayList<>(List.of(events)));
    }

    private com.tea.telemetry.dto.TelemetryEvent error(String message) {
        return event(UUID.randomUUID(), "error", errorPayload(message));
    }

    private com.tea.telemetry.dto.TelemetryEvent vital(String name, double value) {
        return event(UUID.randomUUID(), "vital",
                "{\"name\":\"" + name + "\",\"value\":" + value + ",\"rating\":\"good\","
                        + "\"navigationType\":\"navigate\"}");
    }

    /** payload 为 null 时走「payload 缺失」分支，便于构造非法条目。 */
    private com.tea.telemetry.dto.TelemetryEvent event(UUID id, String type, String payloadJson) {
        return new com.tea.telemetry.dto.TelemetryEvent(id, type, Instant.now(), "/brew",
                payloadJson == null ? null : node(payloadJson));
    }

    private JsonNode node(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("测试 payload 非法: " + json, ex);
        }
    }

    private String errorPayload(String message) {
        return "{\"kind\":\"error\",\"message\":\"" + message + "\",\"source\":\"/assets/index.js\","
                + "\"lineno\":1234,\"colno\":56,\"stack\":\"at foo\"}";
    }

    private void insertReturns(int value) {
        when(eventRepository.insertIfAbsent(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(value);
    }

    @Test
    void validBatchIsAcceptedAndErrorEventUpsertsFingerprint() {
        insertReturns(1);

        TelemetryBatchResult result = service.ingest(batch(
                error("TypeError: boom"),
                vital("LCP", 2345.678)));

        assertThat(result.accepted()).isEqualTo(2);
        assertThat(result.duplicated()).isZero();
        assertThat(result.rejected()).isZero();
        verify(eventRepository, times(2)).insertIfAbsent(any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any());
        // 只有 error 事件触发指纹 upsert；vital 只落 telemetry_events（契约 §9）
        verify(fingerprintRepository, times(1)).upsertOnError(
                eq(new FingerprintService().compute("error", "/assets/index.js", "TypeError: boom", 1234)),
                eq("TypeError: boom"), eq("at foo"), eq("/brew"), any(), any());
    }

    @Test
    void duplicateClientEventIdCountsAsDuplicatedAndSkipsFingerprint() {
        insertReturns(0);

        TelemetryBatchResult result = service.ingest(batch(error("TypeError: boom")));

        assertThat(result.accepted()).isZero();
        assertThat(result.duplicated()).isEqualTo(1);
        assertThat(result.rejected()).isZero();
        verify(fingerprintRepository, never()).upsertOnError(any(), any(), any(), any(), any(), any());
    }

    @Test
    void invalidItemsAreRejectedWithoutAbortingBatch() {
        insertReturns(1);
        List<com.tea.telemetry.dto.TelemetryEvent> events = List.of(
                // type 缺失
                event(UUID.randomUUID(), null, errorPayload("TypeError: boom")),
                // type 非法
                new com.tea.telemetry.dto.TelemetryEvent(UUID.randomUUID(), "custom", Instant.now(), "/brew",
                        node(errorPayload("TypeError: boom"))),
                // vital 指标名不在五指标内
                event(UUID.randomUUID(), "vital", "{\"name\":\"FID\",\"value\":10}"),
                // 合法条目
                event(UUID.randomUUID(), "error", errorPayload("TypeError: boom")));

        TelemetryBatchResult result = service.ingest(
                new TelemetryBatchRequest(clientId, sessionId, "2.0.0", Instant.now(), events));

        assertThat(result.accepted()).isEqualTo(1);
        assertThat(result.rejected()).isEqualTo(3);
        assertThat(result.duplicated()).isZero();
    }

    @Test
    void missingClientIdRejectsWholeRequest() {
        TelemetryBatchRequest request = new TelemetryBatchRequest(null, sessionId, "2.0.0", Instant.now(),
                List.of(event(UUID.randomUUID(), "error", errorPayload("boom"))));

        assertThatThrownBy(() -> service.ingest(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("clientId");
        verify(eventRepository, never()).insertIfAbsent(any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void eventsOverConfiguredLimitRejectsWholeRequest() {
        List<com.tea.telemetry.dto.TelemetryEvent> events = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            events.add(event(UUID.randomUUID(), "error", errorPayload("boom")));
        }
        TelemetryBatchRequest request = new TelemetryBatchRequest(clientId, sessionId, "2.0.0",
                Instant.now(), events);

        assertThatThrownBy(() -> service.ingest(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("50");
    }

    @Test
    void clientProvidedFingerprintIsTrustedWhenFormatIsValid() {
        insertReturns(1);
        com.tea.telemetry.dto.TelemetryEvent event = new com.tea.telemetry.dto.TelemetryEvent(
                UUID.randomUUID(), "error", Instant.now(), "/brew",
                node("{\"kind\":\"error\",\"message\":\"boom\",\"source\":\"/a.js\","
                        + "\"fingerprint\":\"1a2b3c4d5e6f7a8b\"}"));

        service.ingest(new TelemetryBatchRequest(clientId, sessionId, "2.0.0", Instant.now(), List.of(event)));

        verify(fingerprintRepository).upsertOnError(eq("1a2b3c4d5e6f7a8b"), eq("boom"), any(), eq("/brew"),
                any(), any());
    }

    @Test
    void invalidClientFingerprintFallsBackToServerComputation() {
        insertReturns(1);
        com.tea.telemetry.dto.TelemetryEvent event = new com.tea.telemetry.dto.TelemetryEvent(
                UUID.randomUUID(), "error", Instant.now(), "/brew",
                node("{\"kind\":\"error\",\"message\":\"boom\",\"source\":\"/a.js\","
                        + "\"fingerprint\":\"NOT-A-HEX\"}"));

        service.ingest(new TelemetryBatchRequest(clientId, sessionId, "2.0.0", Instant.now(), List.of(event)));

        verify(fingerprintRepository).upsertOnError(
                eq(new FingerprintService().compute("error", "/a.js", "boom", null)), any(), any(), any(),
                any(), any());
    }

    @Test
    void oversizedMessageIsRejectedAndSanitizedForOthers() {
        insertReturns(1);
        List<com.tea.telemetry.dto.TelemetryEvent> events = List.of(
                event(UUID.randomUUID(), "error", errorPayload("茶".repeat(501))),
                event(UUID.randomUUID(), "error", errorPayload("用户 a@b.co 报错")));

        TelemetryBatchResult result = service.ingest(
                new TelemetryBatchRequest(clientId, sessionId, "2.0.0", Instant.now(), events));

        assertThat(result.rejected()).isEqualTo(1);
        assertThat(result.accepted()).isEqualTo(1);
        verify(fingerprintRepository).upsertOnError(any(), eq("用户 <email> 报错"), any(), any(), any(), any());
    }
}
