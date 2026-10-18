package com.tea.ai.quality;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.quality.dto.QualityReport;
import com.tea.ai.quality.dto.QualityReport.AgentQuality;
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
 * 质量聚合口径：零样本 null、样本不足只给均值、分 agent 聚合、覆盖率、窗口过滤与归一。
 * 仓储 mock 掉（口径是纯算术，真库验证交给 QualityMetricsIntegrationTest）。
 */
@ExtendWith(MockitoExtension.class)
class QualityMetricsServiceTest {

    @Mock
    private QualityTraceRepository repository;

    private QualityMetricsService service;

    private final LocalDateTime start = LocalDateTime.of(2026, 10, 18, 9, 0);
    private final LocalDateTime end = LocalDateTime.of(2026, 10, 18, 10, 0);

    @BeforeEach
    void setUp() {
        service = new QualityMetricsService(repository);
    }

    private Object[] overallRow(long total, long judged, Double relevance, Double groundedness,
                                Double actionability, Double tone, Double overall, Double p50) {
        return new Object[] {total, judged, relevance, groundedness, actionability, tone, overall, p50};
    }

    private Object[] agentRow(String agent, long judged, Double relevance, Double groundedness,
                              Double actionability, Double tone, Double overall, Double p50) {
        return new Object[] {agent, judged, relevance, groundedness, actionability, tone, overall, p50};
    }

    @Test
    void zeroJudgedSamplesYieldNullAveragesNotZero() {
        QualityReport report = service.build(
                List.<Object[]>of(overallRow(30, 0, null, null, null, null, null, null)),
                List.<Object[]>of(), start, end);

        assertThat(report.totalTraces()).isEqualTo(30);
        assertThat(report.judgedTraces()).isZero();
        // 0 会被看板读成「答得极差」，真相是「还没评分」
        assertThat(report.relevanceAvg()).isNull();
        assertThat(report.groundednessAvg()).isNull();
        assertThat(report.actionabilityAvg()).isNull();
        assertThat(report.toneAvg()).isNull();
        assertThat(report.overallAvg()).isNull();
        assertThat(report.overallP50()).isNull();
        assertThat(report.coverage()).isZero();
        assertThat(report.insufficientData()).isTrue();
        assertThat(report.byAgent()).isEmpty();
    }

    @Test
    void zeroTracesYieldNullCoverage() {
        QualityReport report = service.build(
                List.<Object[]>of(overallRow(0, 0, null, null, null, null, null, null)),
                List.<Object[]>of(), start, end);

        assertThat(report.coverage()).isNull();
        assertThat(report.insufficientData()).isTrue();
    }

    @Test
    void fewerThanTwentySamplesGiveAveragesButNoMedian() {
        QualityReport report = service.build(
                List.<Object[]>of(overallRow(40, 8, 4.5, 4.0, 3.0, 4.0, 3.875, 4.0)),
                List.<Object[]>of(), start, end);

        assertThat(report.judgedTraces()).isEqualTo(8);
        assertThat(report.insufficientData()).isTrue();
        assertThat(report.overallP50()).isNull();
        // 均值照给：少样本下方向性参考仍然有意义
        assertThat(report.relevanceAvg()).isEqualTo(4.5);
        assertThat(report.overallAvg()).isEqualTo(3.88);
        assertThat(report.coverage()).isEqualTo(0.2);
    }

    @Test
    void twentySamplesEnableMedian() {
        QualityReport report = service.build(
                List.<Object[]>of(overallRow(50, 20, 4.0, 4.0, 4.0, 4.0, 4.0, 3.9)),
                List.<Object[]>of(), start, end);

        assertThat(report.insufficientData()).isFalse();
        assertThat(report.overallP50()).isEqualTo(3.9);
        assertThat(report.coverage()).isEqualTo(0.4);
    }

    @Test
    void byAgentKeepsOnlyGroupsWithJudgedSamples() {
        QualityReport report = service.build(
                List.<Object[]>of(overallRow(60, 45, 4.2, 4.1, 3.8, 4.4, 4.13, 4.1)),
                List.of(
                        agentRow("brewer", 30, 4.5, 4.4, 4.2, 4.6, 4.43, 4.4),
                        agentRow("taster", 15, 3.9, 3.8, 3.4, 4.2, 3.83, 3.8),
                        agentRow("chat", 0, null, null, null, null, null, null)),
                start, end);

        assertThat(report.byAgent()).hasSize(2);
        AgentQuality brewer = report.byAgent().get(0);
        assertThat(brewer.agentType()).isEqualTo("brewer");
        assertThat(brewer.judgedTraces()).isEqualTo(30);
        assertThat(brewer.insufficientData()).isFalse();
        assertThat(brewer.overallP50()).isEqualTo(4.4);

        AgentQuality taster = report.byAgent().get(1);
        assertThat(taster.insufficientData()).isTrue();
        assertThat(taster.overallP50()).isNull();
        assertThat(taster.overallAvg()).isEqualTo(3.83);
    }

    @Test
    void windowIsNormalizedAndPassedToRepository() {
        when(repository.windowQualityOverall(any(), any()))
                .thenReturn(List.<Object[]>of(overallRow(0, 0, null, null, null, null, null, null)));
        when(repository.windowQualityByAgent(any(), any())).thenReturn(List.<Object[]>of());

        QualityReport report = service.quality(0);

        assertThat(Duration.between(report.windowStart(), report.windowEnd()).toMinutes())
                .isEqualTo(QualityMetricsService.DEFAULT_WINDOW_MINUTES);
        ArgumentCaptor<LocalDateTime> startCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).windowQualityOverall(startCaptor.capture(), endCaptor.capture());
        assertThat(startCaptor.getValue()).isEqualTo(report.windowStart());
        assertThat(endCaptor.getValue()).isEqualTo(report.windowEnd());
    }

    @Test
    void windowIsClampedToUpperBound() {
        assertThat(QualityMetricsService.normalizeWindow(1440)).isEqualTo(1440);
        assertThat(QualityMetricsService.normalizeWindow(0))
                .isEqualTo(QualityMetricsService.DEFAULT_WINDOW_MINUTES);
        assertThat(QualityMetricsService.normalizeWindow(-5))
                .isEqualTo(QualityMetricsService.DEFAULT_WINDOW_MINUTES);
        assertThat(QualityMetricsService.normalizeWindow(999_999))
                .isEqualTo(QualityMetricsService.MAX_WINDOW_MINUTES);
    }

    @Test
    void malformedRowsAreSkippedNotThrown() {
        QualityReport report = service.build(
                List.<Object[]>of(new Object[] {"broken"}),
                List.<Object[]>of(new Object[] {"chat"}),
                start, end);

        assertThat(report.totalTraces()).isZero();
        assertThat(report.judgedTraces()).isZero();
        assertThat(report.byAgent()).isEmpty();
        assertThat(report.coverage()).isNull();
    }
}
