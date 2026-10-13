package com.tea.culture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * CultureSearchService 向量分支集成测试（PLAN-ai-capability T05b）：
 * 预插一条 teaware chunk（固定单位向量），mock EmbeddingModel 返回相同向量 →
 * 验证语义查询在 ILIKE 全 miss 时经向量命中补位、关键词查询 ILIKE 优先契约不变、
 * embedding 调用失败自动降级纯 ILIKE（检索不中断，data-layer-product-prd 硬要求）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        // 集成测试共享单例限流器（RANDOM_PORT 同 IP），放宽防止多次调用被 429（生产限流见 application.yml）
        properties = {"tea.ratelimit.ai-anon-max=1000000", "tea.ratelimit.ai-anon-daily-max=10000000",
                "tea.ratelimit.ai-auth-max=1000000", "tea.ratelimit.login-max=1000000"})
@Testcontainers
class CultureSearchVectorBranchIntegrationTest {

    private static final int DIM = 1024; // 对齐 V3 culture_chunks.embedding vector(1024)

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
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MeterRegistry meterRegistry;

    @MockBean
    private EmbeddingModel embeddingModel;

    /** 单位向量 [1,0,0,...]：mock 与预插 chunk 同向量 → 余弦距离 0（相似度 1）。 */
    private float[] unitVector() {
        float[] v = new float[DIM];
        v[0] = 1f;
        return v;
    }

    private String vectorLiteral(float[] v) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(v[i]);
        }
        return sb.append(']').toString();
    }

    @BeforeEach
    void seedVectorChunk() {
        // 幂等插入：Spring context 跨测试方法复用同一容器/库（uk_culture_chunks_source 唯一约束）
        jdbcTemplate.update("""
                        INSERT INTO culture_chunks (source_type, source_id, chunk_text, metadata, embedding, status)
                        VALUES ('teaware', 999, '【茶器】琉璃月盏（盖碗）。半透明琉璃材质，月光下流光溢彩。',
                                '{"sourceName":"琉璃月盏","category":"盖碗"}', ?::vector, 'ready')
                        ON CONFLICT (source_type, source_id) DO UPDATE
                        SET chunk_text = EXCLUDED.chunk_text, metadata = EXCLUDED.metadata,
                            embedding = EXCLUDED.embedding, status = EXCLUDED.status
                        """,
                vectorLiteral(unitVector()));
        when(embeddingModel.embed(anyString())).thenReturn(unitVector());
    }

    @Test
    void semanticQueryHitsVectorChunkWhenKeywordMisses() throws Exception {
        // 查询词避开真实种子词（'琉璃饮器' 无 ILIKE 命中）：语义查询经向量命中预插 chunk
        ResponseEntity<String> res = rest.getForEntity(
                "/api/v1/culture/search?q=有一种半透明如月光的琉璃饮器", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode data = objectMapper.readTree(res.getBody()).path("data");
        assertThat(data.path("teawares").size()).isGreaterThan(0);
        String first = data.path("teawares").get(0).path("name").asText();
        assertThat(first).isEqualTo("琉璃月盏");
    }

    @Test
    void keywordQueryKeepsIlikeFirstAndContract() throws Exception {
        // '紫砂' ILIKE 命中真实种子（紫砂壶）；ILIKE 优先，向量只补空位
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=紫砂", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode data = objectMapper.readTree(res.getBody()).path("data");
        assertThat(data.path("teawares").size()).isGreaterThan(0);
        // 第一条仍是 ILIKE 命中的真实茶器（紫砂壶），而非向量补位（模拟数据排真实数据后）
        assertThat(data.path("teawares").get(0).path("name").asText()).contains("紫砂");
        // 总量契约仍 ≤5
        assertThat(data.path("teawares").size()).isLessThanOrEqualTo(5);
    }

    @Test
    void embeddingFailureDegradesToKeywordOnly() throws Exception {
        // 向量通道失败（embedding 服务不可用）→ 检索不中断，纯 ILIKE 结果
        when(embeddingModel.embed(anyString())).thenThrow(new RuntimeException("embedding upstream down"));
        // 查询词刻意避开真实种子（'饮器''琉璃月华' 在 teawares 无 ILIKE 命中；'盖碗' 会撞真实种子故不用）
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=有一种晶莹剔透的琉璃月华的饮器", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode data = objectMapper.readTree(res.getBody()).path("data");
        assertThat(data.path("teawares").size()).isZero();
        // 降级不影响其他类型检索
        ResponseEntity<String> keyword = rest.getForEntity("/api/v1/culture/search?q=龙井", String.class);
        assertThat(keyword.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(keyword.getBody()).path("data").path("teas").size()).isGreaterThan(0);
        // ragHitRate 观测：embedding 失败必须计入降级计数
        assertThat(meterRegistry.counter("tea.culture.search.vector.degraded", "reason", "embed_failed").count())
                .isPositive();
    }

    @Test
    void vectorMergeDeduplicatesByName() throws Exception {
        // 向量与 ILIKE 命中同一实体（预插 chunk 也名 '紫砂壶'）→ 合并去重，不出现两条同名
        jdbcTemplate.update("""
                        UPDATE culture_chunks
                        SET metadata = '{"sourceName":"紫砂壶","category":"紫砂壶"}', chunk_text = '【茶器】紫砂壶。'
                        WHERE source_type = 'teaware' AND source_id = 999
                        """);
        ResponseEntity<String> res = rest.getForEntity("/api/v1/culture/search?q=紫砂", String.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode teawares = objectMapper.readTree(res.getBody()).path("data").path("teawares");
        int nameCount = 0;
        for (JsonNode n : teawares) {
            if ("紫砂壶".equals(n.path("name").asText())) {
                nameCount++;
            }
        }
        // ILIKE 命中真实紫砂壶 + 向量命中同名预插 chunk → 按 name 去重后仅一条
        assertThat(nameCount).isEqualTo(1);
    }
}
