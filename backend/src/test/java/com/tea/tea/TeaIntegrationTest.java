package com.tea.tea;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * T7 tea 集成测试：真实 HTTP + 真实 Postgres（Testcontainers）+ Flyway V1+V2 种子 + JPA validate。
 * 覆盖：列表分页/筛选/参数契约、详情全字段、404、游客放行（Security GET /api/v1/teas/**）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TeaIntegrationTest {

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
    void listReturnsSeedsWithPagination() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas?page=1&size=20", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("OK");
        assertThat(body.path("data").path("total").asLong()).isEqualTo(66);
        assertThat(body.path("data").path("page").asInt()).isEqualTo(1);
        assertThat(body.path("data").path("items").size()).isEqualTo(20);
        // 默认按 id 排序，第一条是种子首茶
        assertThat(body.path("data").path("items").get(0).path("name").asText()).isEqualTo("西湖龙井");
    }

    @Test
    void listFiltersByCategory() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas?category=绿茶&page=1&size=50", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        long total = body.path("data").path("total").asLong();
        assertThat(total).isGreaterThan(0);
        assertThat(body.path("data").path("items").size()).isEqualTo(Math.toIntExact(total));
        for (JsonNode item : body.path("data").path("items")) {
            assertThat(item.path("category").asText()).isEqualTo("绿茶");
        }
    }

    @Test
    void listRejectsOversizeParam() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas?size=101", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    void listRejectsNonNumericPage() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas?page=abc", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("PARAM_INVALID");
    }

    @Test
    void detailReturnsFullTeaForSeed() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas/1", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        JsonNode tea = body.path("data");
        assertThat(body.path("code").asText()).isEqualTo("OK");
        assertThat(tea.path("name").asText()).isEqualTo("西湖龙井");
        assertThat(tea.path("category").asText()).isEqualTo("绿茶");
        assertThat(tea.path("best_temp").asInt()).isEqualTo(80);
        assertThat(tea.path("best_time").asInt()).isEqualTo(60);
        assertThat(tea.path("flavor").get(0).asText()).isEqualTo("豆香");
        assertThat(tea.path("soup_color_min").asText()).isEqualTo("#F5E6A3");
        assertThat(tea.path("dry_tea_color").asText()).isEqualTo("#4A7C59");
        assertThat(tea.path("story").asText()).isNotBlank();
    }

    @Test
    void detailUnknownIdReturns404() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas/99999", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("NOT_FOUND");
    }

    @Test
    void anonymousCanBrowseTeaCatalog() {
        // 游客（无 token）可浏览茶叶目录：SecurityConfig 放行 GET /api/v1/teas/**
        ResponseEntity<String> res = rest.getForEntity("/api/v1/teas?page=1&size=5", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
