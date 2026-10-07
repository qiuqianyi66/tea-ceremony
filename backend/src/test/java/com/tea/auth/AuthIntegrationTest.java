package com.tea.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.auth.entity.User;
import com.tea.auth.repository.UserRepository;
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

import java.util.Map;

/**
 * T6 认证集成测试：真实 HTTP + 真实 Postgres（Testcontainers）+ Flyway 迁移 + JPA validate。
 * 覆盖：注册/登录真实走通、Security 放行、401 契约、User JSONB（preferredAroma）映射往返。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class AuthIntegrationTest {

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
    private UserRepository userRepository;

    @Test
    void registerPersistsUserAndLoginSucceeds() throws Exception {
        ResponseEntity<String> reg = rest.postForEntity("/api/v1/auth/register",
                Map.of("username", "tea_user", "displayName", "茶友", "password", "secret123"), String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode regBody = objectMapper.readTree(reg.getBody());
        assertThat(regBody.path("code").asText()).isEqualTo("OK");
        assertThat(regBody.path("data").path("token").asText()).isNotBlank();
        assertThat(regBody.path("data").path("user").path("username").asText()).isEqualTo("tea_user");

        // 真实库持久化 + JSONB 列往返读取
        User saved = userRepository.findByUsername("tea_user").orElseThrow();
        assertThat(saved.getDisplayName()).isEqualTo("茶友");
        assertThat(saved.getLevel()).isEqualTo(1);
        assertThat(saved.getXp()).isZero();
        assertThat(saved.getPreferredAroma()).isEmpty();

        ResponseEntity<String> login = rest.postForEntity("/api/v1/auth/login",
                Map.of("username", "tea_user", "password", "secret123"), String.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode loginBody = objectMapper.readTree(login.getBody());
        assertThat(loginBody.path("code").asText()).isEqualTo("OK");
        assertThat(loginBody.path("data").path("token").asText()).isNotBlank();
    }

    @Test
    void loginWithWrongPasswordReturns401() throws Exception {
        rest.postForEntity("/api/v1/auth/register",
                Map.of("username", "wrong_pw_user", "password", "secret123"), String.class);

        ResponseEntity<String> bad = rest.postForEntity("/api/v1/auth/login",
                Map.of("username", "wrong_pw_user", "password", "wrongpass"), String.class);
        assertThat(bad.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        JsonNode body = objectMapper.readTree(bad.getBody());
        assertThat(body.path("code").asText()).isEqualTo("UNAUTHORIZED");
        assertThat(body.path("message").asText()).isEqualTo("用户名或密码错误");
    }

    @Test
    void duplicateRegisterReturns409() throws Exception {
        Map<String, String> payload = Map.of("username", "dup_user", "password", "secret123");
        assertThat(rest.postForEntity("/api/v1/auth/register", payload, String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);

        ResponseEntity<String> dup = rest.postForEntity("/api/v1/auth/register", payload, String.class);
        assertThat(dup.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        JsonNode body = objectMapper.readTree(dup.getBody());
        assertThat(body.path("code").asText()).isEqualTo("CONFLICT");
    }

    @Test
    void healthEndpointIsPermitAll() {
        ResponseEntity<String> health = rest.getForEntity("/actuator/health", String.class);
        assertThat(health.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(health.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void protectedPathWithoutTokenReturns401UnifiedResponse() throws Exception {
        ResponseEntity<String> res = rest.getForEntity("/api/v1/nonexistent", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void protectedPathWithInvalidTokenReturns401UnifiedResponse() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("invalid.token.value");
        ResponseEntity<String> res = rest.exchange("/api/v1/nonexistent", HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("UNAUTHORIZED");
    }
}
