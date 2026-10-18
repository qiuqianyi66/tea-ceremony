package com.tea.ai.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.resilience.AiCallPolicy;
import com.tea.ai.resilience.AiCallTestSupport;
import com.tea.ai.service.AgentSkillRouter;
import com.tea.ai.service.AiCircuitBreaker;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.tool.CultureQueryTools;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.QuotaExceededException;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.culture.vo.PersonItem;
import com.tea.culture.vo.TeaItem;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/**
 * LibrarianAgent Tool Calling 双轨测试。
 *
 * <p>核心约束只有一条：<b>实验未配置 / control 时行为与改造前一致</b>——直接检索、不装配工具。
 * 其余覆盖：treatment 装配工具、来源只取真实命中、失败回落并计数、配额错误不换路径重跑、两条路径都过执行器与计量。</p>
 */
class LibrarianAgentToolCallingTest {

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

    /** 被装配进本次请求的工具实参（treatment 才会非空）。 */
    private CultureQueryTools dispatchedTool;

    private LibrarianAgent agent(String apiKey, ExperimentService experimentService) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.system(anyString())).thenReturn(reqSpec);
        when(reqSpec.user(anyString())).thenReturn(reqSpec);
        when(reqSpec.tools(any(Object[].class))).thenAnswer(invocation -> {
            dispatchedTool = firstTool(invocation.getArguments());
            return reqSpec;
        });
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        when(skillRouter.detect(anyString())).thenReturn(null);
        // prompt 版本化未配置时，真实实现用的是传入的内置常量；测试照抄这个语义
        when(promptService.getPrompt(anyString(), anyString())).thenAnswer(invocation -> invocation.getArgument(1));
        return new LibrarianAgent(builder, search, cultureQueryTools, experimentService, usageLogger,
                promptService, skillRouter, apiKey,
                AiCallTestSupport.executor(AiCallPolicy.defaults(), new AiCircuitBreaker(5, 30_000), registry),
                registry);
    }

    /** varargs 在 Mockito 里的形态随调用方式不同：两种都认一下，测试不因内部表示而脆。 */
    private static CultureQueryTools firstTool(Object[] rawArguments) {
        for (Object argument : rawArguments) {
            if (argument instanceof CultureQueryTools tool) {
                return tool;
            }
            if (argument instanceof Object[] nested) {
                for (Object element : nested) {
                    if (element instanceof CultureQueryTools tool) {
                        return tool;
                    }
                }
            }
        }
        return null;
    }

    private static AiChatRequest question(String q) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", q)), "librarian");
    }

    private static CultureSearchResult hit() {
        return new CultureSearchResult(
                List.of(new TeaItem(1, "龙井", "tea")),
                List.of(new PersonItem(1, "陆羽", "唐", "person")),
                List.of(),
                List.of());
    }

    private static CultureSearchResult empty() {
        return new CultureSearchResult(List.of(), List.of(), List.of(), List.of());
    }

    private void mockLlmReply(String text) {
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    private double invocations(String lane) {
        return registry.counter(LibrarianAgent.METRIC_INVOCATIONS, "lane", lane).count();
    }

    private double fallbacks() {
        return registry.counter(LibrarianAgent.METRIC_FALLBACK).count();
    }

    @Test
    void unconfiguredExperimentKeepsDirectRetrieval() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.noExperiment());
        when(search.search(anyString())).thenReturn(hit());
        mockLlmReply("龙井产于西湖。");

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        verify(search).search("讲讲龙井");
        verify(reqSpec, never()).tools(any(Object[].class));
        assertThat(dispatchedTool).isNull();
        assertThat(vo.sources()).containsExactly("茶·龙井", "人·陆羽");
        assertThat(invocations(LibrarianAgent.LANE_DIRECT)).isEqualTo(1.0);
        assertThat(invocations(LibrarianAgent.LANE_TOOL)).isEqualTo(0.0);
    }

    @Test
    void controlVariantKeepsDirectRetrieval() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.CONTROL));
        when(search.search(anyString())).thenReturn(hit());
        mockLlmReply("龙井产于西湖。");

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        verify(search).search("讲讲龙井");
        verify(reqSpec, never()).tools(any(Object[].class));
        assertThat(vo.sources()).containsExactly("茶·龙井", "人·陆羽");
        assertThat(invocations(LibrarianAgent.LANE_DIRECT)).isEqualTo(1.0);
    }

    @Test
    void treatmentDispatchesCultureQueryToolInsteadOfPrefetchingContext() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        mockLlmReply("我需要检索一下。");

        agent.chat(null, question("讲讲龙井"));

        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        verify(reqSpec).system(system.capture());
        assertThat(system.getValue()).contains("culture_query");
        // treatment 的关键差异：检索结果不再预先拼进 prompt
        assertThat(system.getValue()).doesNotContain("【知识库检索结果】");
        assertThat(dispatchedTool).isNotNull();
        assertThat(dispatchedTool).isNotSameAs(cultureQueryTools);
        verify(search, never()).search(anyString());
        assertThat(invocations(LibrarianAgent.LANE_TOOL)).isEqualTo(1.0);
        assertThat(invocations(LibrarianAgent.LANE_DIRECT)).isEqualTo(0.0);
    }

    @Test
    void treatmentCollectsSourcesFromActualToolHits() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        when(search.search(anyString())).thenReturn(hit());
        mockLlmReply("龙井产于西湖，陆羽《茶经》有载。");
        // 模拟框架侧执行工具：工具写入的命中必须回流成 sources
        when(callSpec.chatResponse()).thenAnswer(invocation -> {
            dispatchedTool.cultureQuery("龙井");
            return response;
        });

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        assertThat(vo.sources()).containsExactly("茶·龙井", "人·陆羽");
        assertThat(vo.content()).doesNotStartWith("⚠");
    }

    @Test
    void treatmentWithoutToolCallReturnsEmptySourcesAndKeepsRiskMarker() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        mockLlmReply("知识库未命中，以下为常识回答：……");

        AiChatVo vo = agent.chat(null, question("泛泛聊聊"));

        // 模型没调工具 = 没有依据：给空数组，绝不编造来源
        assertThat(vo.sources()).isEmpty();
        assertThat(vo.content()).startsWith("⚠ 无来源（知识库未命中，以下为常识回答）");
    }

    @Test
    void treatmentFailureFallsBackToDirectRetrieval() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        when(reqSpec.tools(any(Object[].class))).thenThrow(new IllegalStateException("model does not support tool calling"));
        when(search.search(anyString())).thenReturn(hit());
        mockLlmReply("龙井产于西湖。");

        AiChatVo vo = agent.chat(null, question("讲讲龙井"));

        assertThat(fallbacks()).isEqualTo(1.0);
        assertThat(invocations(LibrarianAgent.LANE_TOOL)).isEqualTo(1.0);
        assertThat(invocations(LibrarianAgent.LANE_DIRECT)).isEqualTo(1.0);
        verify(search).search("讲讲龙井");
        assertThat(vo.sources()).containsExactly("茶·龙井", "人·陆羽");
        assertThat(vo.content()).isEqualTo("龙井产于西湖。");
    }

    @Test
    void quotaExceededDoesNotSwitchToDirectRetrieval() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        when(reqSpec.tools(any(Object[].class))).thenThrow(new QuotaExceededException("本轮对话已达上限"));

        assertThatThrownBy(() -> agent.chat(null, question("讲讲龙井")))
                .isInstanceOf(QuotaExceededException.class);

        // 请求本身被拒：换路径重跑只会再烧一次配额
        assertThat(fallbacks()).isEqualTo(0.0);
        verify(search, never()).search(anyString());
    }

    @Test
    void missingKeyFailsBeforeAnyPathDecision() {
        LibrarianAgent agent = agent("disabled", AiCallTestSupport.experiment(ExperimentService.TREATMENT));

        assertThatThrownBy(() -> agent.chat(null, question("讲讲龙井")))
                .isInstanceOf(BadGatewayException.class);

        verify(search, never()).search(anyString());
        verify(reqSpec, never()).tools(any(Object[].class));
        assertThat(fallbacks()).isEqualTo(0.0);
    }

    @Test
    void bothLanesStillGoThroughResilienceExecutor() {
        LibrarianAgent directAgent = agent("test-key", AiCallTestSupport.noExperiment());
        when(search.search(anyString())).thenReturn(empty());
        mockLlmReply("直接检索回答");
        directAgent.chat(null, question("讲讲茶"));
        double directAttempts = registry.counter("tea.ai.call.attempts",
                "lane", "librarian", "outcome", "success").count();

        registry.clear();
        dispatchedTool = null;
        LibrarianAgent toolAgent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        mockLlmReply("工具路径回答");
        toolAgent.chat(null, question("讲讲茶"));

        // 换路径不能丢超时/重试/熔断：两条都留下执行器的 success 计数
        assertThat(directAttempts).isEqualTo(1.0);
        assertThat(registry.counter("tea.ai.call.attempts",
                "lane", "librarian", "outcome", "success").count()).isEqualTo(1.0);
    }

    @Test
    void treatmentStillLogsTokenUsage() {
        LibrarianAgent agent = agent("test-key", AiCallTestSupport.experiment(ExperimentService.TREATMENT));
        mockLlmReply("工具路径回答");

        agent.chat(7, question("讲讲茶"));

        // 成本计量在两条路径上都要保留（改造前就有的 usageLogger 落库不能被工具路径跳过）
        verify(usageLogger).save(eq(7), eq(question("讲讲茶")), eq(response), anyInt());
    }
}
