package com.tea.ai.resilience;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tea.ai.experiment.service.ExperimentService;
import com.tea.ai.fallback.LocalFallbackService;
import com.tea.ai.service.AiCircuitBreaker;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Optional;

/**
 * 容错层测试装配助手。
 * 为什么集中：既有 Agent/AiChatService 测试只需一个「不重试也不睡」的执行器，
 * 每个文件各写一遍 new 5 个依赖只会让构造器变更时改 7 处。
 */
public final class AiCallTestSupport {

    private AiCallTestSupport() {
    }

    /** 默认策略 + 未熔断 + 零等待：给不关心容错细节的既有测试用。 */
    public static AiCallExecutor executor() {
        return executor(AiCallPolicy.defaults(), new AiCircuitBreaker(5, 30_000), new SimpleMeterRegistry());
    }

    /** 自定义策略/熔断器的执行器（退避一律不真睡，测试不等待）。 */
    public static AiCallExecutor executor(AiCallPolicy policy, AiCircuitBreaker breaker, MeterRegistry registry) {
        return new AiCallExecutor(policy, new AiCallDepthGuard(policy, registry), breaker, millis -> { }, registry);
    }

    /** 与给定策略配套的深度门禁（共用同一个 registry，指标可断言）。 */
    public static AiCallDepthGuard guard(AiCallPolicy policy, MeterRegistry registry) {
        return new AiCallDepthGuard(policy, registry);
    }

    /**
     * 不命中的本地兜底：给「只关心 502 承重墙」的既有测试用。
     * 显式返回 Optional.empty()，而不是依赖 Mockito 对 Optional 的默认答案——
     * 默认答案变动（或换 mock 实现）时不会静默把「兜底未命中」变成「兜底命中」。
     */
    public static LocalFallbackService noFallback() {
        LocalFallbackService service = mock(LocalFallbackService.class);
        when(service.answerFor(anyString())).thenReturn(Optional.empty());
        return service;
    }

    /**
     * 未运行任何实验：assignActive 恒为 empty。
     *
     * <p>这对应生产默认状态（没有实验行），语义是「保持现状」——不能返回 control，
     * 否则会把「没配置实验」误当成「明确要求走旧路径」，把兜底能力关掉。</p>
     */
    public static ExperimentService noExperiment() {
        ExperimentService service = mock(ExperimentService.class);
        when(service.assignActive(anyString(), any())).thenReturn(Optional.empty());
        return service;
    }

    /** 指定变体的实验：control / treatment。 */
    public static ExperimentService experiment(String variant) {
        ExperimentService service = mock(ExperimentService.class);
        when(service.assignActive(anyString(), any())).thenReturn(Optional.of(variant));
        return service;
    }
}
