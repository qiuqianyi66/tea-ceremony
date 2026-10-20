package com.tea.ai.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.ProcessItem;
import com.tea.culture.vo.RegionItem;
import com.tea.culture.vo.TeaItem;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;

/**
 * CultureQueryTools 单元测试：结构化精简文本 / 空命中明确文案 / 异常不抛 / 来源只收真实命中。
 * 这些行为都是「模型决策质量」与「不能 500」的直接依赖，改动工具输出时必须同步这里。
 */
class CultureQueryToolsTest {

    private final CultureSearchService search = mock(CultureSearchService.class);
    private final CultureQueryTools tools = new CultureQueryTools(search);

    private static CultureSearchResult hit() {
        return new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(new PersonItem(1, "陆羽", "唐", "person")),
                List.of(new RegionItem(1, "西湖", "浙江", "region")),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(new ProcessItem(1, "杀青", "绿茶", "process")));
    }

    private static CultureSearchResult empty() {
        return new CultureSearchResult(List.of(), List.of(), List.of(), List.of());
    }

    @Test
    void hitRendersStructuredCompactText() {
        when(search.search("龙井")).thenReturn(hit());

        String out = tools.cultureQuery("龙井");

        assertThat(out).contains("【茶】龙井");
        assertThat(out).contains("【产区】西湖（浙江）");
        assertThat(out).contains("【工艺】杀青（绿茶）");
        assertThat(out).contains("【人物】陆羽（唐）");
        // 结构化文本，不是实体 JSON（实体字段会白烧 token）
        assertThat(out).doesNotContain("\"id\"");
        assertThat(out).doesNotContain("{");
    }

    @Test
    void emptyHitReturnsExplicitNoMatchInsteadOfNull() {
        when(search.search(anyString())).thenReturn(empty());

        String out = tools.cultureQuery("完全冷门的主题");

        assertThat(out).startsWith("库内暂无该关键词对应的条目");
        // 回归锁：空命中文案是给模型的操作指令，不是给用户看的结论句。
        // 旧版以「并说明知识库未命中」结尾，模型会整句复述到回复里，把检索状态暴露给终端用户。
        assertThat(out).doesNotContain("知识库未命中，以下为常识回答");
    }

    @Test
    void blankKeywordStillReturnsTextNotEmpty() {
        when(search.search("")).thenReturn(empty());

        String out = tools.cultureQuery("   ");

        assertThat(out).startsWith("库内暂无该关键词对应的条目");
        verify(search).search("");
    }

    @Test
    void searchFailureReturnsErrorTextAndDoesNotThrow() {
        when(search.search("boom")).thenThrow(new RuntimeException("db down"));

        String out = tools.cultureQuery("boom");

        assertThat(out).startsWith("检索暂不可用");
    }

    @Test
    void boundInstanceCollectsOnlyRealHits() {
        List<CultureSearchResult> sink = new ArrayList<>();
        CultureQueryTools bound = tools.collectingInto(sink);
        when(search.search("龙井")).thenReturn(hit());
        when(search.search("空")).thenReturn(empty());

        bound.cultureQuery("龙井");
        bound.cultureQuery("空");

        assertThat(sink).hasSize(1);
        assertThat(sink.get(0).teas()).extracting(TeaItem::name).containsExactly("龙井");
    }

    @Test
    void failedCallCollectsNothing() {
        List<CultureSearchResult> sink = new ArrayList<>();
        CultureQueryTools bound = tools.collectingInto(sink);
        when(search.search("boom")).thenThrow(new RuntimeException("db down"));

        bound.cultureQuery("boom");

        assertThat(sink).isEmpty();
    }

    @Test
    void overlongKeywordIsTruncatedBeforeSearch() {
        when(search.search(anyString())).thenReturn(empty());
        String longKeyword = "龙".repeat(CultureQueryTools.MAX_KEYWORD_LENGTH + 20);

        tools.cultureQuery(longKeyword);

        verify(search).search(eq("龙".repeat(CultureQueryTools.MAX_KEYWORD_LENGTH)));
    }

    @Test
    void singletonInstanceDoesNotCollect() {
        when(search.search("龙井")).thenReturn(hit());

        // 单例本身没有收集器：不能因为「某个请求绑过 sink」就漏进别人的回复
        assertThat(tools.cultureQuery("龙井")).contains("【茶】龙井");
    }

    @Test
    void springAiRegistrationExposesOnlyKeywordParameterAndExecutes() {
        // 走 Spring AI 真实注册链路（ChatClient.tools(...) 用的就是 MethodToolCallbackProvider）：
        // 证明 @Tool 被识别、参数 schema 里只有 keyword（没有框架注入参数混进去）、调用能真跑通
        List<CultureSearchResult> sink = new ArrayList<>();
        ToolCallback[] callbacks = MethodToolCallbackProvider.builder()
                .toolObjects(tools.collectingInto(sink))
                .build()
                .getToolCallbacks();

        assertThat(callbacks).hasSize(1);
        assertThat(callbacks[0].getToolDefinition().name()).isEqualTo(CultureQueryTools.TOOL_NAME);
        assertThat(callbacks[0].getToolDefinition().description()).contains("什么时候该调用");
        assertThat(callbacks[0].getToolDefinition().inputSchema())
                .contains("\"keyword\"")
                .doesNotContain("ToolContext");

        when(search.search("龙井")).thenReturn(hit());
        assertThat(callbacks[0].call("{\"keyword\":\"龙井\"}")).contains("【茶】龙井");
        assertThat(sink).hasSize(1);
    }
}
