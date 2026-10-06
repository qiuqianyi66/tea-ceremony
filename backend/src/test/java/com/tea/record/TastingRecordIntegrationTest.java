package com.tea.record;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * T8 品鉴记录集成测试：真实 HTTP + 真实 Postgres（Testcontainers）+ Flyway V1+V2 + JPA validate。
 * 覆盖：幂等创建（同 client_id 返回同一条）、越权 404、倒序列表、删除、401、tea_id 校验、JSONB 往返。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TastingRecordIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
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

    private String registerAndGetToken(String username) throws Exception {
        ResponseEntity<String> reg = rest.postForEntity("/api/v1/auth/register",
                Map.of("username", username, "displayName", "茶友", "password", "secret123"), String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(reg.getBody()).path("data").path("token").asText();
    }

    private HttpEntity<String> withToken(String token, Map<String, Object> body) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        return new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
    }

    private Map<String, Object> recordBody(String clientId, Integer teaId) {
        return Map.ofEntries(
                Map.entry("client_id", clientId),
                Map.entry("tea_id", teaId),
                Map.entry("tea_name", "西湖龙井"),
                Map.entry("brew_temp", 80),
                Map.entry("brew_time", 60),
                Map.entry("infusions", 1),
                Map.entry("dimensions", Map.of("bitterness", 3, "sweetness", 4, "aftertaste", 4,
                        "body", 4, "aroma", 4, "rhyme", 3, "shape", 4, "mind", 5)),
                Map.entry("overall_score", 8.5),
                Map.entry("process_factor", 0.9),
                Map.entry("aroma_type", "豆香"),
                Map.entry("notes", "甘甜"),
                Map.entry("weather", "晴"),
                Map.entry("mood", "平静"));
    }

    @Test
    void createIsIdempotentByClientId() throws Exception {
        String token = registerAndGetToken("idem_user");

        ResponseEntity<String> first = rest.postForEntity("/api/v1/records", withToken(token, recordBody("c1", 1)), String.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode firstBody = objectMapper.readTree(first.getBody());
        assertThat(firstBody.path("code").asText()).isEqualTo("OK");
        int id = firstBody.path("data").path("id").asInt();
        assertThat(firstBody.path("data").path("dimensions").path("bitterness").asInt()).isEqualTo(3);

        // 同 client_id 重复提交 → 返回同一条（幂等承重墙），不产生新行
        ResponseEntity<String> second = rest.postForEntity("/api/v1/records", withToken(token, recordBody("c1", 1)), String.class);
        assertThat(objectMapper.readTree(second.getBody()).path("data").path("id").asInt()).isEqualTo(id);

        ResponseEntity<String> list = rest.exchange("/api/v1/records", HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token)), String.class);
        JsonNode listBody = objectMapper.readTree(list.getBody());
        assertThat(listBody.path("data").path("total").asLong()).isEqualTo(1);
    }

    @Test
    void differentUsersSameClientIdGetSeparateRecords() throws Exception {
        String token1 = registerAndGetToken("user_a");
        String token2 = registerAndGetToken("user_b");

        rest.postForEntity("/api/v1/records", withToken(token1, recordBody("shared", 1)), String.class);
        ResponseEntity<String> res2 = rest.postForEntity("/api/v1/records", withToken(token2, recordBody("shared", 1)), String.class);

        // 两用户各自独立记录
        assertThat(objectMapper.readTree(res2.getBody()).path("data").path("id").asInt()).isGreaterThan(0);
        ResponseEntity<String> list1 = rest.exchange("/api/v1/records", HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token1)), String.class);
        ResponseEntity<String> list2 = rest.exchange("/api/v1/records", HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token2)), String.class);
        assertThat(objectMapper.readTree(list1.getBody()).path("data").path("total").asLong()).isEqualTo(1);
        assertThat(objectMapper.readTree(list2.getBody()).path("data").path("total").asLong()).isEqualTo(1);
    }

    @Test
    void listIsDescendingNewestFirst() throws Exception {
        String token = registerAndGetToken("list_user");
        rest.postForEntity("/api/v1/records", withToken(token, recordBody("c1", 1)), String.class);
        rest.postForEntity("/api/v1/records", withToken(token, recordBody("c2", 1)), String.class);
        rest.postForEntity("/api/v1/records", withToken(token, recordBody("c3", 1)), String.class);

        ResponseEntity<String> res = rest.exchange("/api/v1/records", HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token)), String.class);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("data").path("total").asLong()).isEqualTo(3);
        JsonNode items = body.path("data").path("items");
        assertThat(items.size()).isEqualTo(3);
        // created_at 倒序 → 最后创建的 c3 在最前
        assertThat(items.get(0).path("client_id").asText()).isEqualTo("c3");
    }

    @Test
    void detailOfOthersRecordReturns404() throws Exception {
        String token1 = registerAndGetToken("owner_user");
        String token2 = registerAndGetToken("intruder_user");
        ResponseEntity<String> created = rest.postForEntity("/api/v1/records", withToken(token1, recordBody("c1", 1)), String.class);
        int id = objectMapper.readTree(created.getBody()).path("data").path("id").asInt();

        ResponseEntity<String> res = rest.exchange("/api/v1/records/" + id, HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token2)), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(objectMapper.readTree(res.getBody()).path("code").asText()).isEqualTo("NOT_FOUND");
    }

    @Test
    void deleteOwnRecordRemovesIt() throws Exception {
        String token = registerAndGetToken("del_user");
        ResponseEntity<String> created = rest.postForEntity("/api/v1/records", withToken(token, recordBody("c1", 1)), String.class);
        int id = objectMapper.readTree(created.getBody()).path("data").path("id").asInt();

        ResponseEntity<String> del = rest.exchange("/api/v1/records/" + id, HttpMethod.DELETE,
                new HttpEntity<>(tokenHeaders(token)), String.class);
        assertThat(del.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(del.getBody()).path("data").path("message").asText()).isEqualTo("已删除");

        ResponseEntity<String> after = rest.exchange("/api/v1/records/" + id, HttpMethod.GET,
                new HttpEntity<>(tokenHeaders(token)), String.class);
        assertThat(after.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void anonymousCreateReturns401() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        ResponseEntity<String> res = rest.postForEntity("/api/v1/records",
                new HttpEntity<>(objectMapper.writeValueAsString(recordBody("c1", 1)), headers), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(objectMapper.readTree(res.getBody()).path("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void unknownTeaIdReturns400() throws Exception {
        String token = registerAndGetToken("badtea_user");
        ResponseEntity<String> res = rest.postForEntity("/api/v1/records", withToken(token, recordBody("c1", 99999)), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(objectMapper.readTree(res.getBody()).path("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    void missingClientIdReturns400() throws Exception {
        String token = registerAndGetToken("noclient_user");
        Map<String, Object> body = Map.of("tea_name", "西湖龙井");
        ResponseEntity<String> res = rest.postForEntity("/api/v1/records", withToken(token, body), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(objectMapper.readTree(res.getBody()).path("code").asText()).isEqualTo("PARAM_INVALID");
    }

    private HttpHeaders tokenHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
