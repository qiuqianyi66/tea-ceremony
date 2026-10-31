package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.resilience.AiCallTestSupport;
import com.tea.ai.tool.MultiToolAgent;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.QuotaExceededException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

/**
 * 多级兜底接线测试（ADR-022 之后新增的第二级兜底）。
 *
 * 为什么单独一个文件：`LocalFallbackService` 若只被构造、从不被调用，就是「孤儿类」——
 * 编译通过、单测通过、线上却永远走不到。本文件专门证明**失败路径真的能到达兜底**，
 * 以及**未命中时 502 承重墙没有被削弱**。
 */
class AiChatFallbackWiringTest {

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final ChatClient chatClient = mock(ChatClient.class);
    private final AgentOrchestrator orchestrator = mock(AgentOrchestrator.class);
    private final LibrarianAgent librarian = mock(LibrarianAgent.class);
    private final AdvisorAgent advisor = mock(AdvisorAgent.class);
    private final TasterAgent taster = mock(TasterAgent.class);
    private final BrewerAgent brewer = mock(BrewerAgent.class);
    private final MentorAgent mentor = mock(MentorAgent.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final ChatMemoryService memoryService = mock(ChatMemoryService.class);
    private final TraceRecorder traceRecorder = mock(TraceRecorder.class);

    /** 透明代理路径：key 为 disabled 时必定抛 502，用它稳定复现「上游不可用」。 */
    private AiChatService service(AiCallQuota quota, AiCircuitBreaker breaker, LocalFallbackService fallback) {
        return service(quota, breaker, fallback, AiCallTestSupport.noExperiment());
    }

    private AiChatService service(AiCallQuota quota, AiCircuitBreaker breaker,
                                  LocalFallbackService fallback, ExperimentService experimentService) {
        // 参数顺序与 AiChatDeps 字段一致（模型 / 编排 / 记忆 / 专家 / 配额与熔断 / 兜底与实验）
        return new AiChatService(new AiChatDeps(builder, "dashscope", "disabled", "sk-openai-test",
                orchestrator, usageLogger, traceRecorder, memoryService,
                mock(UserMemoryService.class), mock(UserMemoryExtractor.class),
                librarian, advisor, taster, brewer, mentor,
                quota, breaker,
                AiCallTestSupport.executor(), fallback, experimentService,
                mock(MultiToolAgent.class)));
    }

    private static AiChatRequest ask(String text) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", text)), null);
    }

    /** 让路由落到透明代理（type=null）且复杂度 SIMPLE，避免走专家分支。 */
    private void stubTransparentSimple() {
        when(orchestrator.routeToAgent(any())).thenReturn(null);
        when(orchestrator.complexity(any())).thenReturn(ComplexityLevel.SIMPLE);
    }

    @Test
    void upstreamFailureAndRuleHitReturnsDegradedAnswer() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("绿茶建议 80℃ 冲泡，约 50 秒出汤。"));

        AiChatVo vo = service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000), fallback)
                .chat(null, ask("绿茶多少度"));

        assertThat(vo.content()).contains("80℃");
        assertThat(vo.degraded()).isTrue();
        assertThat(vo.sources()).containsExactly("本地规则库");
        // 上游确实失败了，Trace 必须如实记失败（指标口径不能因为兜住就变成成功）
        verify(traceRecorder).fail(any(), any(BadGatewayException.class));
    }

    @Test
    void upstreamFailureAndRuleMissStillThrows502() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.empty());

        AiChatService service = service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000), fallback);

        assertThatThrownBy(() -> service.chat(null, ask("一个规则库答不上的问题")))
                .isInstanceOf(BadGatewayException.class);
    }

    @Test
    void openCircuitUsesFallbackInsteadOfFastFailing() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));
        // 阈值 1：调一次 onFailure 即进入 OPEN
        AiCircuitBreaker breaker = new AiCircuitBreaker(1, 60_000);
        breaker.onFailure();

        AiChatVo vo = service(new AiCallQuota(0), breaker, fallback).chat(null, ask("水温多少"));

        assertThat(vo.degraded()).isTrue();
        // 熔断态下不应再去碰专家/上游
        verify(librarian, never()).chat(any(), any());
    }

    @Test
    void quotaExceededDoesNotUseFallback() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));
        // 配额 1 次：第二次调用超限
        AiChatService service = service(new AiCallQuota(1), new AiCircuitBreaker(5, 30_000), fallback);
        AiChatRequest withSession = new AiChatRequest(List.of(new ChatMessageDto("user", "你好")), null, 7);

        // 第一次：上游不可用 → 兜底命中（这一步会消耗掉唯一一次配额）
        service.chat(1, withSession);

        assertThatThrownBy(() -> service.chat(1, withSession))
                .isInstanceOf(QuotaExceededException.class);
        // 业务错误（429）不是「上游不可用」，不该被规则库冒充成成功。
        // 精确断言「只被调用 1 次」：即第一次的兜底，第二次（配额超限）一次都没碰兜底。
        verify(fallback, times(1)).answerFor(anyString());
    }

    @Test
    void degradedAnswerIsPersistedIntoSessionHistory() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));

        service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000), fallback)
                .chat(1, new AiChatRequest(List.of(new ChatMessageDto("user", "水温")), null, 7));

        // 降级答复也要进历史，否则下一轮多轮锚定会缺一条 assistant
        verify(memoryService).appendMessage(eq(7), eq("assistant"), eq("规则答复"), eq("fallback"), any());
    }

    // ---------------------------------------------------------------- ADR-024 灰度

    @Test
    void controlVariantSuppressesFallbackAndKeeps502() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));

        AiChatService service = service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000),
                fallback, AiCallTestSupport.experiment(ExperimentService.CONTROL));

        // 对照组 = ADR-023 之前的旧语义：直接 502 交前端兜底
        assertThatThrownBy(() -> service.chat(null, ask("绿茶多少度")))
                .isInstanceOf(BadGatewayException.class);
        verify(fallback, never()).answerFor(anyString());
    }

    @Test
    void treatmentVariantUsesFallback() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));

        AiChatVo vo = service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000),
                fallback, AiCallTestSupport.experiment(ExperimentService.TREATMENT))
                .chat(null, ask("绿茶多少度"));

        assertThat(vo.degraded()).isTrue();
        verify(fallback, times(1)).answerFor(anyString());
    }

    @Test
    void variantIsRecordedIntoEvalTrace() {
        stubTransparentSimple();
        LocalFallbackService fallback = mock(LocalFallbackService.class);
        when(fallback.answerFor(anyString())).thenReturn(Optional.of("规则答复"));
        AiEvalTrace[] captured = new AiEvalTrace[1];
        when(traceRecorder.begin(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(inv -> {
                    AiEvalTrace t = new AiEvalTrace();
                    t.setPlanLayer("{\"variant\":\"" + inv.getArgument(5) + "\",\"experiment\":\"" + inv.getArgument(6) + "\"}");
                    captured[0] = t;
                    return t;
                });

        service(new AiCallQuota(0), new AiCircuitBreaker(5, 30_000),
                fallback, AiCallTestSupport.experiment(ExperimentService.TREATMENT))
                .chat(null, ask("绿茶多少度"));

        // 变体必须落到 trace，否则 ExperimentGuardService 无法按組对比指标
        assertThat(captured[0].getPlanLayer()).contains("treatment").contains("ai.fallback.rollout");
    }
}
