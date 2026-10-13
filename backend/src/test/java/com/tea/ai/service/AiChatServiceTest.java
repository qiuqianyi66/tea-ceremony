package com.tea.ai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.BadRequestException;
import com.tea.common.exception.NotFoundException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ChatClient.CallResponseSpec;
import org.springframework.ai.chat.client.ChatClient.ChatClientRequestSpec;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

/** AiChatService 派发矩阵测试（F-5）：五专家派发 / null+CHAT 回落透明代理 / key 缺失 502。 */
class AiChatServiceTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final ChatClientRequestSpec reqSpec = mock(ChatClientRequestSpec.class);
    private final CallResponseSpec callSpec = mock(CallResponseSpec.class);
    private final ChatResponse response = mock(ChatResponse.class);
    private final ChatResponseMetadata metadata = mock(ChatResponseMetadata.class);
    private final AgentOrchestrator orchestrator = mock(AgentOrchestrator.class);
    private final LibrarianAgent librarian = mock(LibrarianAgent.class);
    private final AdvisorAgent advisor = mock(AdvisorAgent.class);
    private final TasterAgent taster = mock(TasterAgent.class);
    private final BrewerAgent brewer = mock(BrewerAgent.class);
    private final MentorAgent mentor = mock(MentorAgent.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final ChatMemoryService memoryService = mock(ChatMemoryService.class);
    private final TraceRecorder traceRecorder = mock(TraceRecorder.class);
    /** 既有用例默认不限配额（0 = 不限），保持本文件原语义；配额专项用例见 AiCallQuotaTest。 */
    private final AiCallQuota unlimitedQuota = new AiCallQuota(0);
    /** P1-13 熔断：既有用例用未熔断实例（阈值 5，正常放行），保持原行为；熔断专项用例单独构造。 */
    private final AiCircuitBreaker closedBreaker = new AiCircuitBreaker(5, 30_000);

    /** 既有用例默认 dashscope 模式（生产承重墙语义），保持原行为。 */
    private AiChatService service(String apiKey) {
        return new AiChatService(builder, usageLogger, orchestrator, memoryService, traceRecorder,
                librarian, advisor, taster, brewer, mentor, unlimitedQuota, closedBreaker,
                "dashscope", apiKey, "sk-openai-test");
    }

    /** gateway profile（openai 模式）：key 检查走 openai key。 */
    private AiChatService gatewayService(String openaiKey) {
        return new AiChatService(builder, usageLogger, orchestrator, memoryService, traceRecorder,
                librarian, advisor, taster, brewer, mentor, unlimitedQuota, closedBreaker,
                "openai", "disabled", openaiKey);
    }

    private static AiChatRequest req(String agent) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", "你好")), agent);
    }

    @Test
    void librarianTypeDispatchesToLibrarian() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("librarian"))).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(null, req("librarian"))).thenReturn(new AiChatVo("答", List.of("茶·龙井")));

        AiChatVo vo = service.chat(null, req("librarian"));

        assertEquals("答", vo.content());
        verify(librarian).chat(null, req("librarian"));
        verify(advisor, never()).chat(null, req("librarian"));
    }

    @Test
    void advisorTypeDispatchesToAdvisor() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("advisor"))).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(null, req("advisor"))).thenReturn(new AiChatVo("推荐", List.of()));

        service.chat(null, req("advisor"));

        verify(advisor).chat(null, req("advisor"));
    }

    @Test
    void tasterTypeDispatchesToTaster() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("taster"))).thenReturn(AgentType.TASTER);
        when(taster.chat(null, req("taster"))).thenReturn(new AiChatVo("点评", List.of()));

        service.chat(null, req("taster"));

        verify(taster).chat(null, req("taster"));
    }

    @Test
    void brewerTypeDispatchesToBrewer() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("brewer"))).thenReturn(AgentType.BREWER);
        when(brewer.chat(null, req("brewer"))).thenReturn(new AiChatVo("方案", List.of()));

        service.chat(null, req("brewer"));

        verify(brewer).chat(null, req("brewer"));
    }

    @Test
    void mentorTypeDispatchesToMentor() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("mentor"))).thenReturn(AgentType.MENTOR);
        when(mentor.chat(null, req("mentor"))).thenReturn(new AiChatVo("建议", List.of()));

        service.chat(null, req("mentor"));        verify(mentor).chat(null, req("mentor"));
    }

    @Test
    void nullTypeFallsBackToTransparentProxy() {
        mockTransparentReply("透明回答");
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("chat"))).thenReturn(null);

        AiChatVo vo = service.chat(null, req("chat"));

        assertEquals("透明回答", vo.content());
        assertNull(vo.sources());
    }

    @Test
    void chatTypeFallsBackToTransparentProxy() {
        mockTransparentReply("透明回答");
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("chat"))).thenReturn(AgentType.CHAT);

        AiChatVo vo = service.chat(null, req("chat"));

        assertEquals("透明回答", vo.content());
        verify(librarian, never()).chat(null, req("chat"));
    }

    @Test
    void transparentMissingKeyThrowsBadGateway() {
        AiChatService service = service("disabled");
        when(orchestrator.routeToAgent(req("chat"))).thenReturn(null);

        assertThrows(BadGatewayException.class, () -> service.chat(null, req("chat")));
    }

    @Test
    void gatewayProfileUsesOpenaiKeyNotDashscope() {
        // gateway 模式：dashscope key=disabled 不拦，openai key 有效 → 走真实 ChatClient
        // 先 stub 再构造（构造时 builder.build() 立即执行）
        mockTransparentReply("透明回答");
        AiChatService service = gatewayService("sk-openai-valid");
        when(orchestrator.routeToAgent(req("chat"))).thenReturn(null);

        AiChatVo vo = service.chat(null, req("chat"));

        assertEquals("透明回答", vo.content());
        verify(builder).build();
    }

    @Test
    void gatewayProfileMissingOpenaiKeyThrowsBadGateway() {
        AiChatService service = gatewayService("disabled");
        when(orchestrator.routeToAgent(req("chat"))).thenReturn(null);

        assertThrows(BadGatewayException.class, () -> service.chat(null, req("chat")));
    }

    @Test
    void unknownAgentPropagates400() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("robot"))).thenThrow(new BadRequestException("未知 agent 类型: robot"));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.chat(null, req("robot")));
        assertEquals("未知 agent 类型: robot", ex.getMessage());
    }

    @Test
    void loggedInChatCreatesSessionAndPersistsMessages() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("advisor"))).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(1, req("advisor"))).thenReturn(new AiChatVo("推荐", List.of("茶·龙井")));
        AiChatSession session = new AiChatSession();
        session.setId(7);
        when(memoryService.createSession(eq(1), eq("你好"), eq("advisor"))).thenReturn(session);

        AiChatVo vo = service.chat(1, req("advisor"));

        assertEquals(7, vo.sessionId());
        verify(memoryService).appendMessage(7, "user", "你好", "advisor", null);
        verify(memoryService).appendMessage(7, "assistant", "推荐", "advisor", null);
    }

    @Test
    void guestChatDoesNotPersist() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("advisor"))).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(null, req("advisor"))).thenReturn(new AiChatVo("推荐", List.of()));

        AiChatVo vo = service.chat(null, req("advisor"));

        assertNull(vo.sessionId());
        verify(memoryService, never()).createSession(any(), any(), any());
        verify(memoryService, never()).appendMessage(any(), any(), any(), any(), any());
    }

    @Test
    void ownedSessionReusedWithoutNewSession() {
        AiChatService service = service("test-key");
        AiChatRequest r = new AiChatRequest(List.of(new ChatMessageDto("user", "继续")), "advisor", 3);
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(1, r)).thenReturn(new AiChatVo("推荐", List.of()));
        when(memoryService.requireSession(1, 3)).thenReturn(new AiChatSession());

        AiChatVo vo = service.chat(1, r);

        assertEquals(3, vo.sessionId());
        verify(memoryService, never()).createSession(any(), any(), any());
        verify(memoryService).appendMessage(3, "user", "继续", "advisor", null);
    }

    @Test
    void othersSessionThrows404BeforeDispatch() {
        AiChatService service = service("test-key");
        AiChatRequest r = new AiChatRequest(List.of(new ChatMessageDto("user", "问")), "advisor", 99);
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.ADVISOR);
        when(memoryService.requireSession(1, 99)).thenThrow(new NotFoundException("会话不存在"));

        assertThrows(NotFoundException.class, () -> service.chat(1, r));
        verify(advisor, never()).chat(any(), any());
        verify(memoryService, never()).appendMessage(any(), any(), any(), any(), any());
    }

    @Test
    void memoryFailureStillReturnsReply() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("advisor"))).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(1, req("advisor"))).thenReturn(new AiChatVo("推荐", List.of()));
        when(memoryService.createSession(any(), any(), any())).thenThrow(new RuntimeException("db down"));

        AiChatVo vo = service.chat(1, req("advisor"));

        assertEquals("推荐", vo.content());
        assertNull(vo.sessionId());
    }

    @Test
    void ownedSessionAnchorsHistoryBeforeTransparentCall() {
        mockTransparentReply("锚定回答");
        AiChatService service = service("test-key");
        AiChatRequest r = new AiChatRequest(List.of(new ChatMessageDto("user", "继续")), "chat", 3);
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.CHAT);
        when(memoryService.requireSession(1, 3)).thenReturn(new AiChatSession());
        AiChatMessage oldUser = new AiChatMessage();
        oldUser.setRole("user");
        oldUser.setContent("上次问的");
        AiChatMessage oldAssistant = new AiChatMessage();
        oldAssistant.setRole("assistant");
        oldAssistant.setContent("上次答的");
        when(memoryService.history(eq(3), eq(20))).thenReturn(List.of(oldUser, oldAssistant));

        AiChatVo vo = service.chat(1, r);

        assertEquals("锚定回答", vo.content());
        assertEquals(3, vo.sessionId());
        // 归属校验只跑一次（anchor 直接读消息，不再二次 requireSession）
        verify(memoryService, times(1)).requireSession(1, 3);
        verify(memoryService, never()).anchorHistory(any(), any());
        verify(memoryService).appendMessage(3, "user", "继续", "chat", null);
        verify(memoryService).appendMessage(3, "assistant", "锚定回答", "chat", null);
        ArgumentCaptor<List<Message>> captor = ArgumentCaptor.forClass(List.class);
        verify(reqSpec).messages(captor.capture());
        List<Message> sent = captor.getValue();
        assertEquals(3, sent.size());
        assertEquals("上次问的", ((UserMessage) sent.get(0)).getText());
        assertEquals("上次答的", ((AssistantMessage) sent.get(1)).getText());
        assertEquals("继续", ((UserMessage) sent.get(2)).getText());
    }

    @Test
    void userMessagePersistedBeforeLlmFailure() {
        AiChatService service = service("disabled");
        AiChatRequest r = new AiChatRequest(List.of(new ChatMessageDto("user", "问")), "chat", 3);
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.CHAT);
        when(memoryService.requireSession(1, 3)).thenReturn(new AiChatSession());
        when(memoryService.history(eq(3), eq(20))).thenReturn(List.of());

        assertThrows(BadGatewayException.class, () -> service.chat(1, r));

        verify(memoryService).appendMessage(3, "user", "问", "chat", null);
        verify(memoryService, never()).appendMessage(eq(3), eq("assistant"), any(), any(), any());
    }

    @Test
    void topicDefaultsToFirstUserMessageTruncatedTo20() {
        AiChatService service = service("test-key");
        String first = "今天想喝什么茶好呢帮我看看一二三四五六七八九十";  // 24 字
        AiChatRequest r = new AiChatRequest(List.of(
                new ChatMessageDto("user", first),
                new ChatMessageDto("assistant", "推荐龙井"),
                new ChatMessageDto("user", "继续")), "advisor");
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(1, r)).thenReturn(new AiChatVo("推荐", List.of()));
        AiChatSession session = new AiChatSession();
        session.setId(7);
        when(memoryService.createSession(eq(1), eq(first.substring(0, 20)), eq("advisor")))
                .thenReturn(session);

        AiChatVo vo = service.chat(1, r);

        assertEquals(7, vo.sessionId());
    }

    // ---- T09 复杂度路由行为（SIMPLE 直答 / COMPLEX 截断） ----

    @Test
    void simpleImplicitRequestSkipsExpertToTransparentChat() {
        mockTransparentReply("直答");
        AiChatService service = service("test-key");
        AiChatRequest r = req(null); // 无显式 agent（隐式文化意图粗分命中）
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.LIBRARIAN);
        when(orchestrator.complexity(r)).thenReturn(ComplexityLevel.SIMPLE);
        when(librarian.chat(null, r)).thenReturn(new AiChatVo("不该走到", List.of()));

        AiChatVo vo = service.chat(null, r);

        // SIMPLE + 隐式 → 透明直答：不走 librarian 专家/RAG
        assertEquals("直答", vo.content());
        verify(librarian, never()).chat(any(), any());
    }

    @Test
    void simpleExplicitAgentStillDispatchesToExpert() {
        AiChatService service = service("test-key");
        AiChatRequest r = req("librarian");
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.LIBRARIAN);
        when(orchestrator.complexity(r)).thenReturn(ComplexityLevel.SIMPLE);
        when(librarian.chat(null, r)).thenReturn(new AiChatVo("专家答", List.of("茶·龙井")));

        AiChatVo vo = service.chat(null, r);

        // 显式 agent 尊重用户选择，即使 SIMPLE 也走专家
        assertEquals("专家答", vo.content());
        verify(librarian).chat(null, r);
    }

    @Test
    void complexRequestTruncatesHistoryToFive() {
        mockTransparentReply("压缩回答");
        AiChatService service = service("test-key");
        AiChatRequest r = new AiChatRequest(List.of(new ChatMessageDto("user", "继续")), "chat", 3);
        when(orchestrator.routeToAgent(r)).thenReturn(AgentType.CHAT);
        when(orchestrator.complexity(r)).thenReturn(ComplexityLevel.COMPLEX);
        when(memoryService.requireSession(1, 3)).thenReturn(new AiChatSession());
        List<AiChatMessage> history = new java.util.ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            AiChatMessage m = new AiChatMessage();
            m.setRole(i % 2 == 0 ? "assistant" : "user");
            m.setContent("历史消息" + i);
            history.add(m);
        }
        when(memoryService.history(eq(3), eq(20))).thenReturn(history);

        AiChatVo vo = service.chat(1, r);

        assertEquals("压缩回答", vo.content());
        ArgumentCaptor<List<Message>> captor = ArgumentCaptor.forClass(List.class);
        verify(reqSpec).messages(captor.capture());
        List<Message> sent = captor.getValue();
        // COMPLEX 压缩：只锚定最后 5 条历史 + 当前 1 条 = 6（起点 i=3 为 assistant 消息）
        assertEquals(6, sent.size());
        assertEquals("历史消息4", ((AssistantMessage) sent.get(0)).getText());
        assertEquals("继续", ((UserMessage) sent.get(5)).getText());
    }

    private void mockTransparentReply(String text) {
        when(builder.build()).thenReturn(chatClient);
        when(chatClient.prompt()).thenReturn(reqSpec);
        when(reqSpec.messages(anyList())).thenReturn(reqSpec);
        when(reqSpec.call()).thenReturn(callSpec);
        when(callSpec.chatResponse()).thenReturn(response);
        when(response.getMetadata()).thenReturn(metadata);
        when(metadata.getModel()).thenReturn("qwen-plus");
        when(metadata.getUsage()).thenReturn(null);
        Generation generation = mock(Generation.class);
        AssistantMessage output = mock(AssistantMessage.class);
        when(response.getResult()).thenReturn(generation);
        when(generation.getOutput()).thenReturn(output);
        when(output.getText()).thenReturn(text);
    }

    @Test
    void openBreakerShortCircuitsTo502WithoutDispatch() {
        // 熔断 OPEN（已连续失败 5 次）：chat 快速抛 BadGatewayException，且不再派发任何专家
        AiCircuitBreaker openBreaker = new AiCircuitBreaker(5, 30_000);
        for (int i = 0; i < 5; i++) {
            openBreaker.onFailure();
        }
        AiChatService service = new AiChatService(builder, usageLogger, orchestrator, memoryService, traceRecorder,
                librarian, advisor, taster, brewer, mentor, unlimitedQuota, openBreaker,
                "dashscope", "test-key", "sk-openai-test");

        assertThrows(BadGatewayException.class, () -> service.chat(null, req("librarian")));
        verify(librarian, never()).chat(any(), any());
        verify(advisor, never()).chat(any(), any());
    }

    @Test
    void failedDispatchRecordsBreakerFailure() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("librarian"))).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(null, req("librarian"))).thenThrow(new BadGatewayException("AI 服务调用失败"));

        assertThrows(BadGatewayException.class, () -> service.chat(null, req("librarian")));

        assertThat(closedBreaker.currentFailures()).isEqualTo(1);
    }

    @Test
    void successfulDispatchRecordsBreakerSuccess() {
        AiChatService service = service("test-key");
        when(orchestrator.routeToAgent(req("librarian"))).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(null, req("librarian"))).thenReturn(new AiChatVo("答", List.of("茶·龙井")));

        service.chat(null, req("librarian"));

        assertThat(closedBreaker.currentFailures()).isZero();
        assertThat(closedBreaker.isOpen()).isFalse();
    }
}
