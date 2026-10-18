package com.tea.ai.metrics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.tea.ai.dto.GoldenMetricsReport;
import com.tea.ai.dto.GoldenMetricsReport.AgentMetrics;
import com.tea.ai.repository.AiEvalTraceRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 黄金指标口径：成功率/错误率的分母、P99 的样本门槛、分组条数、窗口归一。
 * Repository 全部 mock（口径是纯算术，不该为了断言除法去启动数据库；真库验证见 GoldenMetricsIntegrationTest）。
 *
 * 口径决定（已写进 GoldenMetricsService javadoc）：零调用时 successRate/errorRate 为 null，不是 0。
 */
@ExtendWith(MockitoExtension.class)
class GoldenMetricsServiceTest {

    @Mock
    private AiEvalTraceRepository repository;

    private GoldenMetricsService service;

    private final LocalDateTime start = LocalDateTime.of(2026, 10, 18, 9, 0);
    private final LocalDateTime end = LocalDateTime.of(2026, 10, 18, 10, 0);

    @BeforeEach
    void setUp() {
        service = new GoldenMetricsService(repository);
    }

    private Object[] agentRow(String agent, long calls, long success, long errors,
                              Double p50, Double p95, Double p99) {
        return new Object[] {agent, calls, success, errors, p50, p95, p99};
    }

    private Object[] overallRow(long calls, long success, long errors, Double p50, Double p95, Double p99) {
        return new Object[] {calls, success, errors, p50, p95, p99};
    }

    @Test
    void successRateIsSuccessOverTotal() {
        // 30 条（27 成功 / 3 失败）既验证 0.9 的分母口径，也满足 P99 的样本门槛
        GoldenMetricsReport report = service.build(
                List.<Object[]>of(agentRow("brewer", 30, 27, 3, 300.0, 800.0, 1200.0)),
                List.<Object[]>of(overallRow(30, 27, 3, 300.0, 800.0, 1200.0)), start, end);

        AgentMetrics agent = report.byAgent().get(0);
        assertThat(agent.calls()).isEqualTo(30);
        assertThat(agent.successRate()).isEqualTo(0.9);
        assertThat(agent.errorRate()).isEqualTo(0.1);
        assertThat(agent.insufficientData()).isFalse();
        assertThat(report.totalCalls()).isEqualTo(30);
        assertThat(report.overall().successRate()).isEqualTo(0.9);
    }

    @Test
    void zeroCallsYieldNullRatesAndInsufficientData() {
        GoldenMetricsReport report = service.build(List.<Object[]>of(),
                List.<Object[]>of(overallRow(0, 0, 0, null, null, null)), start, end);

        assertThat(report.totalCalls()).isZero();
        assertThat(report.byAgent()).isEmpty();
        AgentMetrics overall = report.overall();
        assertThat(overall.calls()).isZero();
        // 明确选择：无分母不编造成功率（0 会被看板读成「全线故障」）
        assertThat(overall.successRate()).isNull();
        assertThat(overall.errorRate()).isNull();
        assertThat(overall.p50()).isNull();
        assertThat(overall.p99()).isNull();
        assertThat(overall.insufficientData()).isTrue();
    }

    @Test
    void fewerThanTwentySamplesNullOutP99Only() {
        GoldenMetricsReport report = service.build(
                List.<Object[]>of(agentRow("chat", 5, 5, 0, 120.0, 260.0, 280.0)),
                List.<Object[]>of(overallRow(5, 5, 0, 120.0, 260.0, 280.0)), start, end);

        AgentMetrics agent = report.byAgent().get(0);
        assertThat(agent.insufficientData()).isTrue();
        assertThat(agent.p99()).isNull();
        // P50/P95 在少样本下仍有参考性，照常给
        assertThat(agent.p50()).isEqualTo(120.0);
        assertThat(agent.p95()).isEqualTo(260.0);
    }

    @Test
    void twentySamplesEnableP99() {
        // 边界：恰好 20 条即达到 P99 的最小样本数
        GoldenMetricsReport report = service.build(
                List.<Object[]>of(agentRow("chat", 20, 19, 1, 120.0, 260.0, 900.0)),
                List.<Object[]>of(overallRow(20, 19, 1, 120.0, 260.0, 900.0)), start, end);

        AgentMetrics agent = report.byAgent().get(0);
        assertThat(agent.insufficientData()).isFalse();
        assertThat(agent.p99()).isEqualTo(900.0);
        assertThat(agent.successRate()).isEqualTo(0.95);
    }

    @Test
    void byAgentSizeMatchesGroupCount() {
        GoldenMetricsReport report = service.build(
                List.of(
                        agentRow("brewer", 30, 30, 0, 100.0, 200.0, 300.0),
                        agentRow("taster", 25, 20, 5, 150.0, 400.0, 800.0),
                        agentRow("librarian", 22, 22, 0, 90.0, 180.0, 250.0)),
                List.<Object[]>of(overallRow(77, 72, 5, 120.0, 300.0, 700.0)), start, end);

        assertThat(report.byAgent()).hasSize(3);
        assertThat(report.byAgent()).extracting(AgentMetrics::agentType)
                .containsExactly("brewer", "taster", "librarian");
        assertThat(report.byAgent().get(1).errorRate()).isEqualTo(0.2);
    }

    @Test
    void overallUsesItsOwnRowNotAgentDerivation() {
        // overall 分位必须来自全窗口聚合：两组的 P99 都低于 overall P99（合并分布才有长尾）
        GoldenMetricsReport report = service.build(
                List.<Object[]>of(agentRow("a", 20, 20, 0, 100.0, 150.0, 180.0),
                        agentRow("b", 20, 20, 0, 200.0, 250.0, 300.0)),
                List.<Object[]>of(overallRow(40, 40, 0, 150.0, 280.0, 950.0)), start, end);

        assertThat(report.overall().agentType()).isEqualTo(GoldenMetricsService.OVERALL_LABEL);
        assertThat(report.overall().calls()).isEqualTo(40);
        assertThat(report.overall().p99()).isEqualTo(950.0);
    }

    @Test
    void goldenReadsRollingWindowFromRepository() {
        when(repository.windowStatsByAgent(any(), any())).thenReturn(List.<Object[]>of());
        when(repository.windowStatsOverall(any(), any())).thenReturn(List.<Object[]>of(overallRow(0, 0, 0, null, null, null)));

        GoldenMetricsReport report = service.golden(0);

        // windowMinutes <= 0 归一为默认 60 分钟
        assertThat(Duration.between(report.windowStart(), report.windowEnd()).toMinutes()).isEqualTo(60);
        ArgumentCaptor<LocalDateTime> startCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        org.mockito.Mockito.verify(repository).windowStatsByAgent(startCaptor.capture(), endCaptor.capture());
        assertThat(startCaptor.getValue()).isEqualTo(report.windowStart());
        assertThat(endCaptor.getValue()).isEqualTo(report.windowEnd());
    }

    @Test
    void windowIsClampedToUpperBound() {
        assertThat(GoldenMetricsService.normalizeWindow(60)).isEqualTo(60);
        assertThat(GoldenMetricsService.normalizeWindow(0)).isEqualTo(GoldenMetricsService.DEFAULT_WINDOW_MINUTES);
        assertThat(GoldenMetricsService.normalizeWindow(-5)).isEqualTo(GoldenMetricsService.DEFAULT_WINDOW_MINUTES);
        assertThat(GoldenMetricsService.normalizeWindow(99999)).isEqualTo(GoldenMetricsService.MAX_WINDOW_MINUTES);
    }

    @Test
    void malformedRowsAreSkippedNotThrown() {
        GoldenMetricsReport report = service.build(
                List.of(new Object[] {"broken"}, agentRow("chat", 3, 2, 1, null, null, null)),
                List.of(), start, end);

        assertThat(report.byAgent()).hasSize(1);
        assertThat(report.byAgent().get(0).agentType()).isEqualTo("chat");
        assertThat(report.totalCalls()).isZero();
        assertThat(report.overall().successRate()).isNull();
    }
}
