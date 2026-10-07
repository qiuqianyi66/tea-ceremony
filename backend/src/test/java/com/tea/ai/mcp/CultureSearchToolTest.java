package com.tea.ai.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.RegionItem;
import com.tea.culture.vo.TeaItem;
import java.util.List;
import org.junit.jupiter.api.Test;

/** CultureSearchTool 单元测试（F-P1-1）：命中输出紧凑 JSON / 空命中空数组 / 异常兜底错误串。 */
class CultureSearchToolTest {

    private final CultureSearchService search = mock(CultureSearchService.class);
    private final CultureSearchTool tool = new CultureSearchTool(search);

    @Test
    void hitRendersCompactJson() {
        when(search.search("龙井")).thenReturn(new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(),
                List.of(new RegionItem(1, "西湖", "浙江", "region")),
                List.of()));

        String out = tool.cultureSearch("龙井");

        assertThat(out).contains("\"teas\":[\"龙井\"]");
        assertThat(out).contains("\"regions\":[\"西湖\"]");
        assertThat(out).contains("\"people\":[]");
    }

    @Test
    void emptyHitReturnsEmptyArrays() {
        when(search.search("不存在")).thenReturn(
                new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));

        String out = tool.cultureSearch("不存在");

        assertThat(out).contains("\"teas\":[]");
        assertThat(out).contains("\"processes\":[]");
    }

    @Test
    void searchFailureReturnsErrorString() {
        when(search.search("boom")).thenThrow(new RuntimeException("db down"));

        String out = tool.cultureSearch("boom");

        assertThat(out).contains("\"error\":\"检索失败\"");
    }
}
