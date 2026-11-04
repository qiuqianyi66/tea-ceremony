package com.tea.ai.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.service.AgentSkillRouter;
import com.tea.ai.resilience.AiCallPolicy;
import com.tea.ai.resilience.AiCallTestSupport;
import com.tea.ai.service.AiCircuitBreaker;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.tool.CultureQueryTools;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.TeaItem;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/** LibrarianAgent 专家测试（F-S1-3）：RAG 命中带出处 / 空命中说明 / key 缺失 502 / 计量旁路。 */
class LibrarianAgentTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final CultureSearchService search = mock(CultureSearchService.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final PromptService promptService = mock(PromptService.class);
    private final AgentSkillRouter skillRouter = mock(AgentSkillRouter.class);
    private final CultureQueryTools cultureQueryTools = new CultureQueryTools(search);
    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    private LibrarianAgent agent(String apiKey) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        when(skillRouter.detect(anyString())).thenReturn(null);
        // 未配置实验 = 生产默认状态：直接检索（Tool Calling 灰度默认关闭）
        return new LibrarianAgent(builder, search, cultureQueryTools,
                AiCallTestSupport.noExperiment(), usageLogger, promptService, skillRouter, apiKey,
                AiCallTestSupport.executor(AiCallPolicy.defaults(), new AiCircuitBreaker(5, 30_000), registry),
                registry);
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "librarian");
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    @Test
    void ragHitReturnsContentWithSources() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(new PersonItem(1, "陆羽", "唐", "person")),
                List.of(),
                List.of()));
        mockLlmReply("龙井产于西湖产区，陆羽《茶经》有载。");

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        assertTrue(vo.content().contains("龙井"));
        assertEquals(List.of("茶·龙井", "人·陆羽"), vo.sources());
    }

    @Test
    void emptyHitFallsBackToGeneralKnowledge() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("……");

        AiChatVo vo = agent.chat(null, question("完全冷门的问题"));

        assertTrue(vo.sources().isEmpty());
        // P1-5 审计员风险标记：无来源输出必须带「未引自站内文献」警示前缀。
        // 该前缀不得出现「知识库/检索/命中」等内部机制词——那是系统内部状态，不该暴露给用户。
        assertTrue(vo.content().startsWith("以下为茶路常识，未引自站内文献。"));
    }

    @Test
    void missingKeyThrowsBadGateway() {
        LibrarianAgent agent = agent("disabled");
        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("讲讲龙井")));
    }

    @Test
    void successFallsUsageLog() {
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("回答");

        agent.chat(null, question("讲讲茶"));

        verify(usageLogger).save(isNull(), eq(question("讲讲茶")), eq(response), anyInt());
    }

    @Test
    void blankReplyThrowsBadGateway() {
        // 模型返回空白正文 → 必须 502，不能静默降级且计量误判成功
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("   ");

        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("讲讲茶")));
    }

    @Test
    void nullResultReplyThrowsBadGateway() {
        // getResult() 为 null → 旧代码 NPE→500，现应统一 502
        LibrarianAgent agent = agent("test-key");
        when(search.search(anyString())).thenReturn(new CultureSearchResult(List.of(), List.of(), List.of(), List.of()));
        mockLlmReply("回答");
        when(response.getResult()).thenReturn(null);

        assertThrows(BadGatewayException.class, () -> agent.chat(null, question("讲讲茶")));
    }

    // ---- A8 归因观测（2026-11-04）：trace 必须能区分「模型没调工具」与「调了但空命中」 ----

    @Test
    void ragTraceOfEmptyMeansModelDidNotCallTool() {
        var trace = LibrarianAgent.ragTraceOf(List.of());

        assertEquals(0, trace.get("calls"), "没调用时必须显式记 calls=0，不能靠字段缺失推断");
        assertEquals(0, trace.get("empty"));
        assertEquals(List.of(), trace.get("keywords"));
    }

    @Test
    void ragTraceOfCountsEmptyCallsAndKeywords() {
        var traces = List.of(
                new CultureQueryTools.QueryTrace("龙井", 3, java.util.Map.of("tea", 3)),
                new CultureQueryTools.QueryTrace("茶寿", 0, java.util.Map.of("tea", 0)),
                new CultureQueryTools.QueryTrace("boom", -1, java.util.Map.of()));

        var trace = LibrarianAgent.ragTraceOf(traces);

        assertEquals(3, trace.get("calls"));
        // 0 命中与异常(-1)都算「没拿到依据」，两者都必须计入，否则归因会漏掉工具挂掉那一类
        assertEquals(2, trace.get("empty"));
        assertEquals(3, trace.get("total_hits"), "异常不得拉低命中总和（负数按 0 计）");
        assertEquals(List.of("龙井", "茶寿", "boom"), trace.get("keywords"));
    }
}
