package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.ai.resilience.AiCallTestSupport;
import com.tea.ai.tool.MultiToolAgent;
import com.tea.ai.vo.AiChatVo;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;

/**
 * 多实验归属接线测试：trace 的 {@code plan_layer.experiments} 是 A/B 报表唯一的样本来源。
 *
 * <p>为什么单独一个文件：写入侧漏一个实验键不会报错，只会让该实验永远
 * {@code calls=0 / sufficientSample=false}，守门自动回滚永远不触发——静默失效。
 * 本文件逐条钉住「谁该出现在归属里、谁不该」，以及「没配实验时不留残影」。</p>
 *
 * <p>为什么用真实 TraceRecorder 而不是 mock：plan_layer 的 JSON 形状正是被测对象，
 * mock 掉的话断言的是测试自己的拼接逻辑，而不是生产写入逻辑。</p>
 */
class AiChatServiceExperimentAttributionTest {

    private static final String TOOL_KEY = LibrarianAgent.TOOL_CALLING_EXPERIMENT;
    private static final String FALLBACK_KEY = AiChatService.FALLBACK_ROLLOUT_EXPERIMENT;

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final AgentOrchestrator orchestrator = mock(AgentOrchestrator.class);
    private final LibrarianAgent librarian = mock(LibrarianAgent.class);
    private final AdvisorAgent advisor = mock(AdvisorAgent.class);
    private final TasterAgent taster = mock(TasterAgent.class);
    private final BrewerAgent brewer = mock(BrewerAgent.class);
    private final MentorAgent mentor = mock(MentorAgent.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final ChatMemoryService memoryService = mock(ChatMemoryService.class);
    private final AiEvalTraceRepository traceRepository = mock(AiEvalTraceRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TraceRecorder traceRecorder =
            new TraceRecorder(traceRepository, objectMapper, new SimpleMeterRegistry());

    /**
     * 按实验键给变体的实验服务：{@code active} 里没有的键返回 empty（= 实验未运行）。
     * 用 key 反查而不是「一律返回同一变体」，才能区分「没评估」与「评估了但在对照组」。
     */
    private ExperimentService experimentService;

    private AiChatService service(Map<String, String> active) {
        experimentService = mock(ExperimentService.class);
        when(experimentService.assignActive(any(), any()))
                .thenAnswer(inv -> Optional.ofNullable(active.get(inv.<String>getArgument(0))));
        when(traceRepository.save(any(AiEvalTrace.class))).thenAnswer(inv -> inv.getArgument(0));
        return new AiChatService(new AiChatDeps(builder, "dashscope", "test-key", "sk-openai-test",
                orchestrator, usageLogger, traceRecorder, memoryService,
                librarian, advisor, taster, brewer, mentor,
                new AiCallQuota(0), new AiCircuitBreaker(5, 30_000),
                AiCallTestSupport.executor(), AiCallTestSupport.noFallback(), experimentService,
                mock(MultiToolAgent.class)));
    }

    private static AiChatRequest req(String agent) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", "讲讲龙井")), agent);
    }

    /** 取本次请求 begin 时写入的 plan_layer（complete 会再落一次，取第一条 = begin 的那条）。 */
    private JsonNode capturedPlan() throws Exception {
        ArgumentCaptor<AiEvalTrace> captor = ArgumentCaptor.forClass(AiEvalTrace.class);
        verify(traceRepository, atLeastOnce()).save(captor.capture());
        return objectMapper.readTree(captor.getAllValues().get(0).getPlanLayer());
    }

    @Test
    void librarianRouteAttributesToolCallingExperiment() throws Exception {
        when(orchestrator.routeToAgent(any())).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(any(), any())).thenReturn(new AiChatVo("答", List.of()));
        Map<String, String> active = new LinkedHashMap<>();
        active.put(TOOL_KEY, ExperimentService.TREATMENT);

        service(active).chat(null, req("librarian"));

        JsonNode experiments = capturedPlan().path("experiments");
        assertThat(experiments.path(TOOL_KEY).asText()).isEqualTo(ExperimentService.TREATMENT);
        assertThat(experiments.size()).isEqualTo(1);
    }

    @Test
    void otherAgentRouteDoesNotAttributeToolCallingExperiment() throws Exception {
        // 非 librarian 请求根本没经过 tool-calling 开关：记进去会把无关流量算给该实验，对比失真
        when(orchestrator.routeToAgent(any())).thenReturn(AgentType.ADVISOR);
        when(advisor.chat(any(), any())).thenReturn(new AiChatVo("推荐", List.of()));
        Map<String, String> active = new LinkedHashMap<>();
        active.put(TOOL_KEY, ExperimentService.TREATMENT);
        AiChatService service = service(active);

        service.chat(null, req("advisor"));

        assertThat(capturedPlan().has("experiments")).isFalse();
        // 连评估都不该发生：非 librarian 路由不参与该实验
        verify(experimentService, never()).assignActive(eq(TOOL_KEY), any());
    }

    @Test
    void librarianRouteAttributesBothRunningExperiments() throws Exception {
        when(orchestrator.routeToAgent(any())).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(any(), any())).thenReturn(new AiChatVo("答", List.of()));
        Map<String, String> active = new LinkedHashMap<>();
        active.put(FALLBACK_KEY, ExperimentService.TREATMENT);
        active.put(TOOL_KEY, ExperimentService.CONTROL);

        service(active).chat(null, req("librarian"));

        JsonNode plan = capturedPlan();
        assertThat(plan.path("experiments").path(FALLBACK_KEY).asText()).isEqualTo(ExperimentService.TREATMENT);
        assertThat(plan.path("experiments").path(TOOL_KEY).asText()).isEqualTo(ExperimentService.CONTROL);
        // 顶层历史字段仍指向兜底实验，既有查询口径不变
        assertThat(plan.path("variant").asText()).isEqualTo(ExperimentService.TREATMENT);
        assertThat(plan.path("experiment").asText()).isEqualTo(FALLBACK_KEY);
    }

    @Test
    void unconfiguredExperimentsLeaveTraceShapeUnchanged() throws Exception {
        when(orchestrator.routeToAgent(any())).thenReturn(AgentType.LIBRARIAN);
        when(librarian.chat(any(), any())).thenReturn(new AiChatVo("答", List.of()));

        service(Map.of()).chat(null, req("librarian"));

        JsonNode plan = capturedPlan();
        assertThat(plan.has("experiments")).isFalse();
        assertThat(plan.has("variant")).isFalse();
        assertThat(plan.has("experiment")).isFalse();
    }
}
