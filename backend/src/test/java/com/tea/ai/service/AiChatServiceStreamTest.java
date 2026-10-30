package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.resilience.AiCallTestSupport;
import com.tea.common.exception.BadGatewayException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.client.ChatClient.StreamResponseSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

/**
 * AiChatService 流式（SSE）服务层测试（B1.3，F-1）。
 *
 * <p>只走公共接口 {@link AiChatService#chatStream}；外部协作者（ChatClient/路由/计量/Trace/记忆/兜底）
 * 按 AiChatServiceTest 同法 mock。两个测试 seam 是源码自带的：</p>
 * <ul>
 *   <li>{@code streamExecutor} 包级字段 → 替换为同步执行（Runnable::run），流内联跑完即可断言帧序列；</li>
 *   <li>{@code testFrames} 包级字段 → 所有 SSE 帧收集进 List，免起 MVC handler。</li>
 * </ul>
 *
 * <p>结算时机（PR #43 教训）：用量/Trace/熔断必须在「流结束」才结算，不能在建立 emitter 时或首 chunk 后。</p>
 */
class AiChatServiceStreamTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final StreamResponseSpec streamSpec = mock(StreamResponseSpec.class);
    private final AgentOrchestrator orchestrator = mock(AgentOrchestrator.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final ChatMemoryService memoryService = mock(ChatMemoryService.class);
    private final TraceRecorder traceRecorder = mock(TraceRecorder.class);
    private final LibrarianAgent librarian = mock(LibrarianAgent.class);
    private final AdvisorAgent advisor = mock(AdvisorAgent.class);
    private final TasterAgent taster = mock(TasterAgent.class);
    private final BrewerAgent brewer = mock(BrewerAgent.class);
    private final MentorAgent mentor = mock(MentorAgent.class);
    private final AiCallQuota quota = new AiCallQuota(0);

    private LocalFallbackService fallback;
    private AiCircuitBreaker breaker;
    private List<String> frames;

    @BeforeEach
    void setUp() {
        fallback = AiCallTestSupport.noFallback();
        breaker = new AiCircuitBreaker(5, 30_000);
        frames = new ArrayList<>();
        when(orchestrator.routeToAgent(any())).thenReturn(null);
    }

    private AiChatService newService(String modelChat, String dashscopeKey, String openaiKey) {
        AiChatDeps deps = new AiChatDeps(builder, modelChat, dashscopeKey, openaiKey,
                orchestrator, usageLogger, traceRecorder, memoryService,
                librarian, advisor, taster, brewer, mentor,
                quota, breaker,
                AiCallTestSupport.executor(), fallback, AiCallTestSupport.noExperiment());
        AiChatService service = new AiChatService(deps);
        // 同步执行 + 帧收集 seam
        service.streamExecutor = Runnable::run;
        service.testFrames = frames;
        return service;
    }

    private static AiChatRequest req() {
        return new AiChatRequest(List.of(new ChatMessageDto("user", "你好")), null);
    }

    /** 让 .stream().chatResponse() 返回给定 chunk 文本序列（null 文本 = 仅元数据 chunk，不下发 delta）。 */
    private void mockStreamChunks(String... texts) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.messages(anyList())).thenReturn(reqSpec);
        when(reqSpec.stream()).thenReturn(streamSpec);
        List<ChatResponse> responses = new ArrayList<>();
        for (String t : texts) {
            responses.add(streamResponse(t));
        }
        when(streamSpec.chatResponse()).thenReturn(Flux.fromIterable(responses));
    }

    private static ChatResponse streamResponse(String text) {
        ChatResponse resp = mock(ChatResponse.class);
        Generation gen = mock(Generation.class);
        AssistantMessage out = mock(AssistantMessage.class);
        when(resp.getResult()).thenReturn(gen);
        when(gen.getOutput()).thenReturn(out);
        when(out.getText()).thenReturn(text);
        return resp;
    }

    @Test
    void deltasEmittedInOrderThenMetaAndDone() {
        mockStreamChunks("今", "天", null, "茶"); // null chunk 仅元数据，不应产出 delta
        AiChatService service = newService("dashscope", "test-key", "sk-openai-test");

        SseEmitter emitter = service.chatStream(null, req());

        // 3 个文本 chunk → 3 条 delta；null chunk 跳过；末帧 meta + [DONE]
        assertThat(frames).containsExactly(
                "{\"d\":\"今\"}",
                "{\"d\":\"天\"}",
                "{\"d\":\"茶\"}",
                "{\"meta\":{}}",
                "[DONE]");
        assertThat(emitter).isNotNull();
        // 流成功结束才结算：计量 + Trace complete + 熔断成功
        verify(usageLogger).save(any(), any(), any(ChatResponse.class), anyInt());
        verify(traceRecorder).complete(any(), any());
        assertThat(breaker.currentFailures()).isZero();
    }

    @Test
    void upstreamErrorEmitsErrorFrameAndFailsTrace() {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.messages(anyList())).thenReturn(reqSpec);
        when(reqSpec.stream()).thenReturn(streamSpec);
        when(streamSpec.chatResponse()).thenReturn(Flux.error(new RuntimeException("upstream boom")));
        AiChatService service = newService("dashscope", "test-key", "sk-openai-test");

        service.chatStream(null, req());

        assertThat(frames).containsExactly("{\"error\":\"BAD_GATEWAY\"}");
        verify(traceRecorder).fail(any(), any());
        verify(usageLogger, never()).save(any(), any(), any(ChatResponse.class), anyInt());
        assertThat(breaker.currentFailures()).isEqualTo(1);
    }

    @Test
    void blankOutputEmitsErrorFrameInsteadOf200Empty() {
        // 全部 chunk 都没有正文 → 不能 200 空体，必须 error 帧
        mockStreamChunks("", null);
        AiChatService service = newService("dashscope", "test-key", "sk-openai-test");

        service.chatStream(null, req());

        assertThat(frames).containsExactly("{\"error\":\"BAD_GATEWAY\"}");
        verify(traceRecorder).fail(any(), any());
    }

    @Test
    void missingKeyThrowsBeforeEmitter() {
        AiChatService service = newService("dashscope", "disabled", "sk-openai-test");

        assertThrows(BadGatewayException.class, () -> service.chatStream(null, req()));
        // 预流失败：未建立流，不该有任何帧
        assertThat(frames).isEmpty();
    }

    @Test
    void openBreakerWithoutRuleThrows502BeforeStream() {
        for (int i = 0; i < 5; i++) {
            breaker.onFailure();
        }
        AiChatService service = newService("dashscope", "test-key", "sk-openai-test");

        assertThrows(BadGatewayException.class, () -> service.chatStream(null, req()));
        assertThat(frames).isEmpty();
        verify(traceRecorder).fail(any(), any());
    }

    @Test
    void openBreakerWithRuleFallsBackToSingleChunk() {
        for (int i = 0; i < 5; i++) {
            breaker.onFailure();
        }
        // 本地规则库命中 → 单 chunk 兜底（delta + meta + DONE）
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("龙井推荐你试试"));
        AiChatService service = newService("dashscope", "test-key", "sk-openai-test");

        service.chatStream(null, req());

        assertThat(frames).containsExactly(
                "{\"d\":\"龙井推荐你试试\"}",
                "{\"meta\":{}}",
                "[DONE]");
        verify(traceRecorder).fail(any(), any());
    }
}
