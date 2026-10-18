package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.telemetry.entity.ErrorFingerprint;
import com.tea.telemetry.repository.ErrorFingerprintRepository;
import com.tea.telemetry.repository.TelemetryEventRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * 遥测集成测试：真实 HTTP + 真实 Postgres（Testcontainers）+ Flyway V8 + JPA validate。
 * 验证单测覆盖不到的部分：ON CONFLICT 幂等真的生效、指纹 upsert 计数在 DB 里递增、
 * 新建指纹的 review_status 真的是 pending、鉴权边界与状态机在 HTTP 层的实际状态码。
 *
 * 本机无 Docker 时整类跳过（disabledWithoutDocker）：缺 Docker 是环境问题，不是代码问题，
 * 让套件保持可区分——跳过会显式报 skipped，不会被读成通过。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tea.ratelimit.ai-anon-max=1000000", "tea.ratelimit.ai-anon-daily-max=10000000",
                "tea.ratelimit.ai-auth-max=1000000", "tea.ratelimit.login-max=1000000",
                "tea.ratelimit.telemetry-anon-max=1000000"})
@Testcontainers(disabledWithoutDocker = true)
class TelemetryIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("pgvector/pgvector:pg16")
            .withDatabaseName("tea")
            .withUsername("tea")
            .withPassword("tea");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TelemetryEventRepository eventRepository;

    @Autowired
    private ErrorFingerprintRepository fingerprintRepository;

    private Map<String, Object> errorEvent(UUID clientEventId, String message) {
        return Map.of(
                "clientEventId", clientEventId.toString(),
                "type", "error",
                "occurredAt", Instant.now().toString(),
                "route", "/brew",
                "payload", Map.of(
                        "kind", "error",
                        "message", message,
                        "source", "/assets/index.js",
                        "lineno", 1234,
                        "colno", 56,
                        "stack", "at foo (/assets/index.js:1:2)"));
    }

    private Map<String, Object> vitalEvent(UUID clientEventId, String name, double value) {
        return Map.of(
                "clientEventId", clientEventId.toString(),
                "type", "vital",
                "occurredAt", Instant.now().toString(),
                "route", "/brew",
                "payload", Map.of("name", name, "value", value, "rating", "good",
                        "navigationType", "navigate"));
    }

    private Map<String, Object> batch(UUID clientId, UUID sessionId, List<Map<String, Object>> events) {
        return Map.of(
                "clientId", clientId.toString(),
                "sessionId", sessionId.toString(),
                "appVersion", "2.0.0",
                "sentAt", Instant.now().toString(),
                "events", events);
    }

    private ResponseEntity<String> postBatch(Map<String, Object> body) {
        return rest.postForEntity("/api/v1/telemetry/batch", body, String.class);
    }

    private String register(String username) throws Exception {
        ResponseEntity<String> reg = rest.postForEntity("/api/v1/auth/register",
                Map.of("username", username, "password", "secret123"), String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(reg.getBody()).path("data").path("token").asText();
    }

    private HttpEntity<String> jsonWithToken(String token, Object body) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return new HttpEntity<>(body == null ? null : objectMapper.writeValueAsString(body), headers);
    }

    @Test
    void duplicateBatchIsIdempotentAndFingerprintCountsOnce() throws Exception {
        UUID clientId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        UUID errorEventId = UUID.randomUUID();
        String message = "TypeError: Cannot read properties of undefined (reading 'dup-check')";
        Map<String, Object> body = batch(clientId, sessionId,
                List.of(errorEvent(UUID.randomUUID(), message), vitalEvent(errorEventId, "LCP", 2100.5)));

        ResponseEntity<String> first = postBatch(body);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode firstData = objectMapper.readTree(first.getBody()).path("data");
        assertThat(firstData.path("accepted").asInt()).isEqualTo(2);
        assertThat(firstData.path("duplicated").asInt()).isZero();

        ResponseEntity<String> second = postBatch(body);
        JsonNode secondData = objectMapper.readTree(second.getBody()).path("data");
        assertThat(secondData.path("accepted").asInt()).isZero();
        assertThat(secondData.path("duplicated").asInt()).isEqualTo(2);

        long rows = eventRepository.count();
        ErrorFingerprint stored = fingerprintRepository.findAll().stream()
                .filter(fp -> fp.getSampleMessage().equals(message))
                .findFirst()
                .orElseThrow();
        assertThat(stored.getReviewStatus()).isEqualTo("pending");
        assertThat(stored.getOccurrences()).isEqualTo(1);
        assertThat(rows).isGreaterThanOrEqualTo(2);

        // 同一 bug 的新实例（不同 clientEventId、行号落在同一桶）→ occurrences 递增，指纹不新增
        long fingerprintsBefore = fingerprintRepository.count();
        Map<String, Object> again = batch(clientId, sessionId,
                List.of(errorEvent(UUID.randomUUID(), message)));
        assertThat(objectMapper.readTree(postBatch(again).getBody()).path("data").path("accepted").asInt())
                .isEqualTo(1);
        assertThat(fingerprintRepository.count()).isEqualTo(fingerprintsBefore);
        ErrorFingerprint updated = fingerprintRepository.findById(stored.getId()).orElseThrow();
        assertThat(updated.getOccurrences()).isEqualTo(2);
    }

    @Test
    void batchRejectsOversizedBatchWith400() {
        List<Map<String, Object>> events = new java.util.ArrayList<>();
        for (int i = 0; i < 51; i++) {
            events.add(errorEvent(UUID.randomUUID(), "TypeError: over limit"));
        }
        ResponseEntity<String> res = postBatch(batch(UUID.randomUUID(), UUID.randomUUID(), events));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void invalidItemDoesNotBreakBatch() throws Exception {
        Map<String, Object> badEvent = Map.of(
                "clientEventId", UUID.randomUUID().toString(),
                "type", "unknown-type",
                "occurredAt", Instant.now().toString(),
                "route", "/brew",
                "payload", Map.of());
        Map<String, Object> body = batch(UUID.randomUUID(), UUID.randomUUID(),
                List.of(badEvent, vitalEvent(UUID.randomUUID(), "TTFB", 300)));

        JsonNode data = objectMapper.readTree(postBatch(body).getBody()).path("data");
        assertThat(data.path("accepted").asInt()).isEqualTo(1);
        assertThat(data.path("rejected").asInt()).isEqualTo(1);
    }

    @Test
    void batchIsAnonymousButAdminEndpointsRequireJwt() {
        assertThat(postBatch(batch(UUID.randomUUID(), UUID.randomUUID(),
                List.of(vitalEvent(UUID.randomUUID(), "FCP", 1200)))).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        assertThat(rest.getForEntity("/api/v1/telemetry/slo", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(rest.getForEntity("/api/v1/telemetry/fingerprints", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void reviewStateMachineEnforcedOverHttp() throws Exception {
        String token = register("telemetry_reviewer");
        String message = "TypeError: review flow " + UUID.randomUUID();
        postBatch(batch(UUID.randomUUID(), UUID.randomUUID(),
                List.of(errorEvent(UUID.randomUUID(), message))));

        ResponseEntity<String> list = rest.exchange("/api/v1/telemetry/fingerprints?reviewStatus=pending",
                HttpMethod.GET, jsonWithToken(token, null), String.class);
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode items = objectMapper.readTree(list.getBody()).path("data").path("items");
        assertThat(items.isArray()).isTrue();

        long id = 0;
        for (JsonNode item : items) {
            if (message.equals(item.path("sampleMessage").asText())) {
                id = item.path("id").asLong();
            }
        }
        assertThat(id).isPositive();

        // pending → acknowledged → resolved 合法
        ResponseEntity<String> ack = rest.exchange("/api/v1/telemetry/fingerprints/" + id + "/review",
                HttpMethod.PATCH, jsonWithToken(token, Map.of("status", "acknowledged", "note", "已确认")),
                String.class);
        assertThat(ack.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(ack.getBody()).path("data").path("reviewStatus").asText())
                .isEqualTo("acknowledged");

        ResponseEntity<String> resolved = rest.exchange("/api/v1/telemetry/fingerprints/" + id + "/review",
                HttpMethod.PATCH, jsonWithToken(token, Map.of("status", "resolved")), String.class);
        assertThat(resolved.getStatusCode()).isEqualTo(HttpStatus.OK);

        // resolved 是终态，再改 → 409
        ResponseEntity<String> illegal = rest.exchange("/api/v1/telemetry/fingerprints/" + id + "/review",
                HttpMethod.PATCH, jsonWithToken(token, Map.of("status", "acknowledged")), String.class);
        assertThat(illegal.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(objectMapper.readTree(illegal.getBody()).path("code").asText()).isEqualTo("CONFLICT");
    }
}
