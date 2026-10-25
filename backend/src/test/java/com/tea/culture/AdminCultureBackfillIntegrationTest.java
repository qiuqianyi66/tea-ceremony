package com.tea.culture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.support.PostgresIntegrationTestBase;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * culture_chunks 回填管线集成测试（PLAN-ai-capability T04）：真实 HTTP + 真实 Postgres（Testcontainers）+ V2/V3 种子。
 * 无 AI key（默认 disabled）：验证 T04 降级路径——chunk_text 照常落库（status=pending），embedding 留待有 key 后补嵌；
 * 管理端点鉴权（/api/v1/admin/** 需登录）；幂等（uk_culture_chunks_source + ON CONFLICT，重复跑不重复插）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class AdminCultureBackfillIntegrationTest extends PostgresIntegrationTestBase {

    @DynamicPropertySource
    static void adminToken(DynamicPropertyRegistry registry) {
        // 2026-10-12 安全审计 H1：管理端点改认独立访问令牌（datasource 装配见 PostgresIntegrationTestBase）
        registry.add("tea.admin.token", () -> "test-admin-token-123456");
    }

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private org.springframework.beans.factory.ObjectProvider<EmbeddingModel> embeddingProvider;

    /**
     * 嵌入服务不可用（模拟：dashscope starter 在 key disabled 时 bean 仍存在但真实调用会失败/超时；
     * mock 抛异常可确定性验证降级路径——chunk_text 照常落库、status=pending、不产生费用）。
     */
    @MockBean
    private EmbeddingModel embeddingModel;

    private String registerAndGetToken() {
        String user = "backfill_" + System.nanoTime();
        ResponseEntity<String> reg = rest.postForEntity("/api/v1/auth/register",
                Map.of("username", user, "displayName", "回填测试", "password", "secret123"), String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.OK);
        try {
            return objectMapper.readTree(reg.getBody()).path("data").path("token").asText();
        } catch (Exception e) {
            throw new AssertionError("解析注册响应失败", e);
        }
    }

    private ResponseEntity<String> backfill(String token, boolean embed) {
        return backfill(token, embed, "test-admin-token-123456");
    }

    /** @param adminToken 传 null 则不发管理令牌头 */
    private ResponseEntity<String> backfill(String token, boolean embed, String adminToken) {
        HttpHeaders headers = new HttpHeaders();
        if (token != null) {
            headers.setBearerAuth(token);
        }
        if (adminToken != null) {
            headers.set("X-Admin-Token", adminToken);
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange("/api/v1/admin/culture/chunks/backfill?embed=" + embed,
                HttpMethod.POST, new HttpEntity<>(null, headers), String.class);
    }

    @Test
    void backfillRequiresAdminToken() {
        // 管理端点的唯一闸门是独立管理令牌（AdminTokenFilter：fail-closed + 常量时间比较）。
        // 注意这里必须显式传 adminToken=null —— 2 参重载会带上有效令牌，那样测的就不是「匿名」了
        // （2026-10-19 修正：原用例用 2 参重载，实际带令牌，却按「匿名请求」断言，名实不符）。
        ResponseEntity<String> noToken = backfill(null, false, null);
        assertThat(noToken.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        ResponseEntity<String> wrongToken = backfill(null, false, "wrong-token");
        assertThat(wrongToken.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    /**
     * 设计确认：管理端点只认管理令牌，不要求用户 JWT。
     *
     * <p>AdminTokenFilter 的 javadoc 与 SecurityConfig 的注释都写着「管理端点不再接受用户 JWT，
     * 仅接受独立令牌头 X-Admin-Token」，但此前 SecurityFilterChain 仍要求 authenticated，
     * 导致运维侧 curl（没有用户 JWT）永远调不通管理端点——灰度实验只能等自动回滚，无法人工止血。
     * 此用例把「仅凭令牌即可调用」固化为契约。</p>
     */
    @Test
    void backfillAcceptsAdminTokenWithoutUserJwt() {
        ResponseEntity<String> res = backfill(null, false, "test-admin-token-123456");
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /**
     * 2026-10-12 安全审计 H1 回归：开放注册下，普通登录用户的 JWT 不再能调用管理端点——
     * 修复前此用例注册普通用户后调用返回 200（任意人可触发付费 embedding），修复后 401。
     */
    @Test
    void backfillRejectsNormalUserJwtWithoutAdminToken() {
        String token = registerAndGetToken();
        ResponseEntity<String> res = backfill(token, false, null);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // 错误管理令牌同样拒绝
        ResponseEntity<String> wrong = backfill(token, false, "wrong-token");
        assertThat(wrong.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void backfillFillsAllEightTypesWithoutKey() throws Exception {
        // 容器前置自检：V2 种子必须在（否则下方 perType/计数断言全无意义）
        Integer teasCount = jdbcTemplate.queryForObject("SELECT count(*) FROM teas", Integer.class);
        assertThat(teasCount).isGreaterThan(0);
        // 嵌入服务不可用：每批 embed(List) 抛异常 → 全部降级 pending（T04 验收：管线不中断、落库可补嵌）
        when(embeddingModel.embed(anyList())).thenThrow(new RuntimeException("embedding upstream down"));
        // mock 自检：stub 必须生效，否则下方断言无意义（防假阳性）
        try {
            embeddingModel.embed(List.of("mock 自检"));
            throw new AssertionError("mock stub 未生效：embed(List) 未抛异常");
        } catch (RuntimeException e) {
            assertThat(e.getMessage()).isEqualTo("embedding upstream down");
        }
        // 关键接线验证：service 经 ObjectProvider 拿到的必须是这个 mock（否则降级断言全是假象）
        assertThat(embeddingProvider.getIfAvailable()).isSameAs(embeddingModel);
        String token = registerAndGetToken();
        ResponseEntity<String> res = backfill(token, true);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(res.getBody());
        assertThat(body.path("code").asText()).isEqualTo("OK");
        JsonNode data = body.path("data");
        // 嵌入失败：全 pending，不产生费用
        assertThat(data.path("embedded").asInt()).isZero();
        assertThat(data.path("pending").asInt()).isGreaterThan(0);
        assertThat(data.path("embedStatus").asText()).contains("degraded");
        // 八张表均有 chunk（T05 验收：8 表均有对应 chunks 的数据前提）
        JsonNode perType = data.path("perType");
        assertThat(perType.path("tea").asInt()).isGreaterThan(0);
        assertThat(perType.path("person").asInt()).isGreaterThan(0);
        assertThat(perType.path("region").asInt()).isGreaterThan(0);
        assertThat(perType.path("poem").asInt()).isGreaterThan(0);
        assertThat(perType.path("teaware").asInt()).isGreaterThan(0);
        assertThat(perType.path("etiquette").asInt()).isGreaterThan(0);
        assertThat(perType.path("process").asInt()).isGreaterThan(0);
        // relation 表当前为空（T06 回填后才有）——V2 无数据，此处允许为 0，T06 迁移测试另行覆盖
        Integer count = jdbcTemplate.queryForObject("SELECT count(*) FROM culture_chunks", Integer.class);
        assertThat(count).isGreaterThan(0);
        Integer ready = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM culture_chunks WHERE status = 'ready'", Integer.class);
        assertThat(ready).isZero();
    }

    @Test
    void backfillIsIdempotent() throws Exception {
        String token = registerAndGetToken();
        ResponseEntity<String> first = backfill(token, false);
        Integer countAfterFirst = jdbcTemplate.queryForObject("SELECT count(*) FROM culture_chunks", Integer.class);
        ResponseEntity<String> second = backfill(token, false);
        Integer countAfterSecond = jdbcTemplate.queryForObject("SELECT count(*) FROM culture_chunks", Integer.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        // ON CONFLICT DO UPDATE：行数不增长（幂等）
        assertThat(countAfterSecond).isEqualTo(countAfterFirst);
        assertThat(countAfterFirst).isGreaterThan(0);
        JsonNode data = objectMapper.readTree(second.getBody()).path("data");
        assertThat(data.path("total").asInt()).isEqualTo(countAfterFirst);
    }
}
