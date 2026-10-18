package com.tea.ai.experiment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.experiment.dto.GuardrailConfig;
import com.tea.ai.experiment.dto.VariantMetrics;
import com.tea.ai.experiment.entity.AbExperiment;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import com.tea.ai.experiment.service.ExperimentGuardService;
import com.tea.ai.experiment.service.ExperimentService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 回滚判据：样本门槛、错误率差值、P99 比值、null 语义、自定义阈值、端到端停止动作。
 *
 * shouldRollback 是静态纯函数，直接断言原因文本（原因要能解释「为什么回滚」，运维据此定位）；
 * 最后一例走 evaluateRunning，验证命中后真的调用 stop 并打点（单测覆盖不到接线，端到端覆盖不到判据分支）。
 */
@ExtendWith(MockitoExtension.class)
class ExperimentGuardTest {

    private static final String KEY = "ai.fallback.enabled";
    private static final GuardrailConfig DEFAULTS = GuardrailConfig.defaults();

    @Mock
    private AbExperimentRepository repository;

    @Mock
    private ExperimentService experimentService;

    private MeterRegistry meterRegistry;
    private ExperimentGuardService guardService;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        guardService = new ExperimentGuardService(repository, experimentService, meterRegistry);
    }

    private static VariantMetrics variant(String name, long calls, Double errorRate, Double p99) {
        return new VariantMetrics(name, calls, errorRate, p99);
    }

    @Test
    void insufficientSampleSkipsDecision() {
        // treatment 错误率 60% vs 30%，差值远超阈值，但 29 条 < minSampleSize(30) → 不判
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 100, 0.30, 100.0),
                variant("treatment", 29, 0.60, 100.0),
                DEFAULTS);

        assertThat(reason).isEmpty();
    }

    @Test
    void zeroSampleControlSkipsDecision() {
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 0, null, null),
                variant("treatment", 500, 0.90, 5000.0),
                DEFAULTS);

        assertThat(reason).isEmpty();
    }

    @Test
    void errorRateDeltaTriggersRollback() {
        // 0.10 - 0.02 = 0.08 > 0.05；P99 相同因此只有一条原因
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 200, 0.02, 120.0),
                variant("treatment", 200, 0.10, 120.0),
                DEFAULTS);

        assertThat(reason).isPresent();
        assertThat(reason.get()).contains("error_rate");
        assertThat(reason.get()).doesNotContain("p99");
        assertThat(reason.get()).contains("0.080");
    }

    @Test
    void p99RatioTriggersRollback() {
        // 240 / 120 = 2.0 > 1.5；错误率相同因此只有 p99 一条原因
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 200, 0.02, 120.0),
                variant("treatment", 200, 0.02, 240.0),
                DEFAULTS);

        assertThat(reason).isPresent();
        assertThat(reason.get()).contains("p99");
        assertThat(reason.get()).doesNotContain("error_rate");
        assertThat(reason.get()).contains("2.00");
    }

    @Test
    void healthyPairDoesNotRollback() {
        // 差值 0.01 < 0.05，比值 1.1 < 1.5
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 500, 0.02, 100.0),
                variant("treatment", 500, 0.03, 110.0),
                DEFAULTS);

        assertThat(reason).isEmpty();
    }

    @Test
    void nullControlErrorRateIsNotTreatedAsZero() {
        // 样本门槛显式关掉（minSampleSize=0），逼出 null 分支：control 没有 errorRate 时不能拿 0 当基准，
        // 否则 treatment 任何一次失败都会被判成「错误率飙升」
        GuardrailConfig noSampleGate = new GuardrailConfig(0.05, 1.5, 0);

        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 100, null, 100.0),
                variant("treatment", 100, 0.50, 100.0),
                noSampleGate);

        assertThat(reason).isEmpty();
    }

    @Test
    void customThresholdsOverrideDefaults() {
        // 放宽到 0.20 / 3.0：同样的 0.08 差值与 2.0 比值都不再触发
        GuardrailConfig lenient = new GuardrailConfig(0.20, 3.0, 30);
        assertThat(ExperimentGuardService.shouldRollback(
                variant("control", 200, 0.02, 120.0),
                variant("treatment", 200, 0.10, 240.0),
                lenient)).isEmpty();

        // 收紧到 0.01 / 1.0：同一组数据两项都触发
        GuardrailConfig strict = new GuardrailConfig(0.01, 1.0, 30);
        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 200, 0.02, 120.0),
                variant("treatment", 200, 0.10, 240.0),
                strict);
        assertThat(reason).isPresent();
        assertThat(reason.get()).contains("error_rate").contains("p99");
    }

    @Test
    void bothBreachesAreReportedTogether() {
        GuardrailConfig strict = new GuardrailConfig(0.01, 1.2, 30);

        Optional<String> reason = ExperimentGuardService.shouldRollback(
                variant("control", 300, 0.01, 100.0),
                variant("treatment", 300, 0.20, 300.0),
                strict);

        assertThat(reason).isPresent();
        // 两条原因用 "; " 拼接，运维一次看到全部触发项
        assertThat(reason.get()).contains(";").contains("error_rate").contains("p99");
    }

    @Test
    void guardrailDefaultsWhenJsonIsEmptyOrBroken() {
        assertThat(GuardrailConfig.fromJson(null)).isEqualTo(DEFAULTS);
        assertThat(GuardrailConfig.fromJson(new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()))
                .isEqualTo(DEFAULTS);

        // 部分键：只配 minSampleSize，其余回落默认
        com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper()
                .createObjectNode().put("minSampleSize", 5);
        GuardrailConfig parsed = GuardrailConfig.fromJson(node);
        assertThat(parsed.minSampleSize()).isEqualTo(5);
        assertThat(parsed.maxErrorRateDelta()).isEqualTo(GuardrailConfig.DEFAULT_MAX_ERROR_RATE_DELTA);
        assertThat(parsed.maxP99Ratio()).isEqualTo(GuardrailConfig.DEFAULT_MAX_P99_RATIO);
    }

    @Test
    void unattributedTraceStatsCountForTheOnlyRunningExperiment() {
        // 写入侧（TraceRecorder）目前只写 variant，不写 experiment：
        // 唯一 running 实验时未标注的行必须被计入，否则自动回滚永远看不到样本（静默失效）
        AbExperiment experiment = new AbExperiment();
        experiment.setExpKey(KEY);
        experiment.setStatus(AbExperiment.STATUS_RUNNING);
        when(repository.findByStatus(AbExperiment.STATUS_RUNNING)).thenReturn(List.of(experiment));
        when(experimentService.variantStats()).thenReturn(Map.of("", Map.of(
                ExperimentService.CONTROL, variant("control", 200, 0.01, 100.0),
                ExperimentService.TREATMENT, variant("treatment", 200, 0.30, 400.0))));
        when(experimentService.guardrailOf(experiment)).thenReturn(DEFAULTS);

        guardService.evaluateRunning();

        verify(experimentService).recordEvaluation(eq(KEY), eq(400), any(LocalDateTime.class));
        verify(experimentService).stop(eq(KEY), org.mockito.ArgumentMatchers.startsWith("auto_rollback: "));
    }

    @Test
    void unattributedStatsAreIgnoredWhenTwoExperimentsRun() {
        // 两个实验并行时未标注的行无法区分归属：忽略（宁可少算，也不算给错误的实验）
        AbExperiment first = new AbExperiment();
        first.setExpKey(KEY);
        first.setStatus(AbExperiment.STATUS_RUNNING);
        AbExperiment second = new AbExperiment();
        second.setExpKey("ai.agent.router");
        second.setStatus(AbExperiment.STATUS_RUNNING);
        when(repository.findByStatus(AbExperiment.STATUS_RUNNING)).thenReturn(List.of(first, second));
        when(experimentService.variantStats()).thenReturn(Map.of("", Map.of(
                ExperimentService.CONTROL, variant("control", 200, 0.01, 100.0),
                ExperimentService.TREATMENT, variant("treatment", 200, 0.30, 400.0))));
        when(experimentService.guardrailOf(any())).thenReturn(DEFAULTS);

        guardService.evaluateRunning();

        verify(experimentService, never()).stop(anyString(), anyString());
        verify(experimentService).recordEvaluation(eq(KEY), eq(0), any(LocalDateTime.class));
    }

    @Test
    void evaluateRunningStopsBreachingExperimentAndCountsRollback() {
        AbExperiment experiment = new AbExperiment();
        experiment.setExpKey(KEY);
        experiment.setStatus(AbExperiment.STATUS_RUNNING);
        experiment.setTrafficPercent((short) 10);
        when(repository.findByStatus(AbExperiment.STATUS_RUNNING)).thenReturn(List.of(experiment));
        when(experimentService.variantStats()).thenReturn(Map.of(KEY, Map.of(
                ExperimentService.CONTROL, variant("control", 200, 0.01, 100.0),
                ExperimentService.TREATMENT, variant("treatment", 200, 0.30, 400.0))));
        when(experimentService.guardrailOf(experiment)).thenReturn(DEFAULTS);

        guardService.evaluateRunning();

        verify(experimentService).recordEvaluation(eq(KEY), eq(400), any(LocalDateTime.class));
        verify(experimentService).stop(eq(KEY), org.mockito.ArgumentMatchers.startsWith("auto_rollback: "));
        assertThat(meterRegistry.get(ExperimentGuardService.AUTO_ROLLBACK_COUNTER).tag("exp", KEY)
                .counter().count()).isEqualTo(1.0);
    }

    @Test
    void evaluateRunningLeavesHealthyExperimentAlone() {
        AbExperiment experiment = new AbExperiment();
        experiment.setExpKey(KEY);
        experiment.setStatus(AbExperiment.STATUS_RUNNING);
        when(repository.findByStatus(AbExperiment.STATUS_RUNNING)).thenReturn(List.of(experiment));
        when(experimentService.variantStats()).thenReturn(Map.of(KEY, Map.of(
                ExperimentService.CONTROL, variant("control", 200, 0.01, 100.0),
                ExperimentService.TREATMENT, variant("treatment", 200, 0.02, 110.0))));
        when(experimentService.guardrailOf(experiment)).thenReturn(DEFAULTS);

        guardService.evaluateRunning();

        verify(experimentService).recordEvaluation(eq(KEY), anyInt(), any(LocalDateTime.class));
        verify(experimentService, never()).stop(anyString(), anyString());
        assertThat(meterRegistry.find(ExperimentGuardService.AUTO_ROLLBACK_COUNTER).counter()).isNull();
    }
}
