package com.tea.culture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.culture.service.CultureSearchService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/**
 * 文化检索向量分支的 embedding 缓存（成本维度）。
 *
 * <p>缓存契约（有意为之的设计，改代码前先读）：
 * <ul>
 *   <li><b>只缓存向量、不缓存检索结果</b>——embedding 是 q 的纯函数（同输入同输出），无失效问题；
 *       检索结果依赖 culture_chunks 内容，backfill 新增 chunk 后必须即时反映，缓存结果会读到陈旧数据。</li>
 *   <li>失败不缓存——上游 embedding 抛异常时降级为纯 ILIKE，那次失败不应占缓存位。</li>
 * </ul>
 * 背景：embedding 是付费调用，而 ragHitRate 长期低位（大量查询未产生向量命中），
 * 重复查询重复付费纯属浪费。</p>
 */
class CultureSearchServiceCacheTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final EmbeddingModel embeddingModel = mock(EmbeddingModel.class);
    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private CultureSearchService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        // 八表 ILIKE 与 pgvector 查询全部返回空，隔离出「embedding 调用次数」这一个观测点
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        when(embeddingModel.embed(anyString())).thenReturn(new float[] {0.1f, 0.2f});
        service = new CultureSearchService(jdbcTemplate, providerOf(embeddingModel), registry);
    }

    @Test
    void repeatedQueryEmbedsOnlyOnce() {
        service.search("龙井");
        service.search("龙井");

        verify(embeddingModel, times(1)).embed("龙井");
    }

    @Test
    void distinctQueriesEmbedSeparately() {
        service.search("龙井");
        service.search("陆羽");

        verify(embeddingModel, times(1)).embed("龙井");
        verify(embeddingModel, times(1)).embed("陆羽");
    }

    @Test
    void vectorQueryStillRunsOnEverySearch() {
        // 缓存只省 embedding，不省 pgvector 检索：backfill 新 chunk 必须即时可见
        service.search("龙井");
        service.search("龙井");

        verify(jdbcTemplate, times(2))
                .query(argThat(sql -> sql.contains("<=>")), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void cacheHitAndMissAreCounted() {
        service.search("龙井");
        service.search("龙井");

        assertEquals(1.0, registry.get("tea.culture.search.vector.cache")
                .tag("outcome", "hit").counter().count());
        assertEquals(1.0, registry.get("tea.culture.search.vector.cache")
                .tag("outcome", "miss").counter().count());
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<EmbeddingModel> providerOf(EmbeddingModel model) {
        ObjectProvider<EmbeddingModel> provider = mock(ObjectProvider.class);
        when(provider.getIfUnique()).thenReturn(model);
        return provider;
    }
}
