package com.tea.culture;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Culture search 集成测试 + AI 无 key 502 路径：真实 HTTP + 真实 Postgres（Testcontainers）+ V2 种子。
 * 不设 API key（默认 disabled）：验证 R1 对策——应用正常启动，ai/chat 502 触发前端降级，culture/search 正常。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class CultureSearchIntegrationTest {

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

    @Test
    void searchReturnsTeaSeeds() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=龙井", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("OK");
        assertThat(body.path("data").path("teas").size()).isGreaterThan(0);
        assertThat(body.path("data").path("teas").get(0).path("name").asText()).contains("龙井");
        assertThat(body.path("data").path("teas").get(0).path("type").asText()).isEqualTo("tea");
    }

    @Test
    void blankQueryReturnsEmptyArrays() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode data = objectMapper.readTree(res.getBody()).path("data");
        assertThat(data.path("teas").size()).isZero();
        assertThat(data.path("people").size()).isZero();
        assertThat(data.path("regions").size()).isZero();
        assertThat(data.path("poems").size()).isZero();
        assertThat(data.path("teawares").size()).isZero();
        assertThat(data.path("etiquettes").size()).isZero();
        assertThat(data.path("relations").size()).isZero();
        assertThat(data.path("processes").size()).isZero();
    }

    @Test
    void searchHitsTeawareSeeds() throws Exception {
        // 8 表 RAG（ADR-013）：茶器表纳入检索
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=紫砂", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("OK");
        assertThat(body.path("data").path("teawares").size()).isGreaterThan(0);
        assertThat(body.path("data").path("teawares").get(0).path("type").asText()).isEqualTo("teaware");
    }

    @Test
    void anonymousCanSearch() {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=茶", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void longSentenceQueryHitsTeas() throws Exception {
        // T11 评测抓到的真 bug：整句 %q% ILIKE 对长句必 miss（"铁观音"命中、完整问句全空）。
        // 修复：连接词切分关键词 + OR 参数化；本用例回归：长句须命中铁观音。
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=铁观音和武夷岩茶有什么区别？", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("OK");
        JsonNode teas = body.path("data").path("teas");
        assertThat(teas.size()).isGreaterThan(0);
        assertThat(teas.get(0).path("name").asText()).contains("铁观音");
    }

    @Test
    void longSentenceWithParticleHitsPeople() throws Exception {
        // v2 评测 LIB-002/003 抓出：切分后"陆羽的"带尾虚词 → ILIKE %陆羽的% 对 name=陆羽 miss。
        // 修复：splitKeywords 剥离尾部语气虚词；本用例回归：长句须命中陆羽（tea_people）。
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=陆羽的茶经大概讲了什么", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        JsonNode people = body.path("data").path("people");
        assertThat(people.size()).isGreaterThan(0);
        assertThat(people.get(0).path("name").asText()).contains("陆羽");
    }

    @Test
    void aiChatWithoutKeyReturns502() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(
                "{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}", headers);

        ResponseEntity<String> res = rest.postForEntity("/api/v1/ai/chat", entity, String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
    }
}
