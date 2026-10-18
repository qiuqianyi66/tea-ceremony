package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.telemetry.config.TelemetryProperties;
import com.tea.telemetry.dto.SloReport;
import com.tea.telemetry.dto.SloReport.MetricDetail;
import com.tea.telemetry.repository.SloSnapshotRepository;
import com.tea.telemetry.repository.TelemetryEventRepository;
import com.tea.telemetry.service.SloEvaluationService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * SLO 评分（契约 §6）：P75 → 达成系数 → 加权健康分。
 * 达成系数是分段函数，边界值（恰好达标 / 恰好超 50% / 超 50% 一点）最容易写错，
 * 因此逐个边界断言；健康分再验加权与 1 位小数舍入。
 */
@ExtendWith(MockitoExtension.class)
class SloEvaluationServiceTest {

    @Mock
    private TelemetryEventRepository eventRepository;

    @Mock
    private SloSnapshotRepository snapshotRepository;

    private SloEvaluationService service;

    private final LocalDateTime start = LocalDateTime.of(2026, 10, 17, 0, 0);
    private final LocalDateTime end = LocalDateTime.of(2026, 10, 18, 0, 0);

    @BeforeEach
    void setUp() {
        // 用默认 TelemetryProperties：默认值必须等于契约 §6 常量（2500/200/0.1/1800/800 + 25/25/20/15/15）
        service = new SloEvaluationService(eventRepository, snapshotRepository, new TelemetryProperties());
    }

    private Object[] row(String metric, double p75, long count) {
        return new Object[] {metric, p75, count};
    }

    private List<Object[]> allMet() {
        return List.of(
                row("LCP", 2000, 100),
                row("INP", 150, 100),
                row("CLS", 0.05, 100),
                row("FCP", 1000, 100),
                row("TTFB", 500, 100));
    }

    // ---- 达成系数边界 ----

    @Test
    void achievementIsOneWhenP75EqualsTarget() {
        assertThat(SloEvaluationService.achievementFactor(2500, 2500)).isEqualTo(1.0);
        assertThat(SloEvaluationService.achievementFactor(1000, 2500)).isEqualTo(1.0);
    }

    @Test
    void achievementDecaysLinearlyUpToFiftyPercentOver() {
        // LCP 3125 = 超出 25% → 1 - 0.25/2 = 0.875
        assertThat(SloEvaluationService.achievementFactor(3125, 2500)).isEqualTo(0.875);
    }

    @Test
    void achievementIs075WhenExactlyFiftyPercentOver() {
        // 契约示例：LCP 3750（超出 50%）→ 0.75，25 权重得 18.75
        assertThat(SloEvaluationService.achievementFactor(3750, 2500)).isEqualTo(0.75);
    }

    @Test
    void achievementDropsTo02WhenMoreThanFiftyPercentOver() {
        assertThat(SloEvaluationService.achievementFactor(3751, 2500)).isEqualTo(0.2);
        assertThat(SloEvaluationService.achievementFactor(9000, 2500)).isEqualTo(0.2);
    }

    @Test
    void achievementHandlesClsScale() {
        assertThat(SloEvaluationService.achievementFactor(0.1, 0.1)).isEqualTo(1.0);
        assertThat(SloEvaluationService.achievementFactor(0.15, 0.1)).isEqualTo(0.75);
    }

    // ---- 健康分加权 ----

    @Test
    void allMetricsMetScoresFullHundred() {
        SloReport report = service.evaluate(allMet(), start, end);

        assertThat(report.healthScore()).isEqualTo(100.0);
        assertThat(report.insufficientData()).isFalse();
        assertThat(report.metrics()).hasSize(5).allMatch(MetricDetail::met);
        assertThat(report.metrics()).extracting(MetricDetail::metric)
                .containsExactly("LCP", "INP", "CLS", "FCP", "TTFB");
    }

    @Test
    void oneMetricOverTargetProducesWeightedScoreWithOneDecimal() {
        // LCP 3750 → 0.75 × 25 = 18.75；其余四项达标 → 25+20+15+15 = 75；合计 93.75 → 93.8（1 位小数）
        List<Object[]> rows = new ArrayList<>(allMet());
        rows.set(0, row("LCP", 3750, 100));

        SloReport report = service.evaluate(rows, start, end);

        MetricDetail lcp = report.metrics().get(0);
        assertThat(lcp.p75()).isEqualTo(3750.0);
        assertThat(lcp.achievement()).isEqualTo(0.75);
        assertThat(lcp.score()).isEqualTo(18.75);
        assertThat(lcp.met()).isFalse();
        assertThat(report.healthScore()).isEqualTo(93.8);
        assertThat(report.insufficientData()).isFalse();
    }

    @Test
    void severeOvershootScoresTwentyPercentOfWeight() {
        List<Object[]> rows = new ArrayList<>(allMet());
        rows.set(1, row("INP", 500, 100)); // 200 → 500 超出 150% → 系数 0.2 → 5 分

        SloReport report = service.evaluate(rows, start, end);

        assertThat(report.metrics().get(1).achievement()).isEqualTo(0.2);
        assertThat(report.metrics().get(1).score()).isEqualTo(5.0);
        assertThat(report.healthScore()).isEqualTo(80.0);
    }

    @Test
    void missingSamplesScoreZeroAndFlagInsufficientData() {
        SloReport report = service.evaluate(List.of(), start, end);

        assertThat(report.healthScore()).isZero();
        assertThat(report.insufficientData()).isTrue();
        assertThat(report.metrics()).hasSize(5).allMatch(detail -> detail.sampleCount() == 0)
                .allMatch(detail -> detail.p75() == null)
                .allMatch(detail -> !detail.met());
    }

    @Test
    void singleMetricMissingMarksInsufficientDataButKeepsOthers() {
        List<Object[]> rows = List.of(
                row("LCP", 2000, 10),
                row("INP", 150, 10),
                row("CLS", 0.05, 10),
                row("FCP", 1000, 10));

        SloReport report = service.evaluate(rows, start, end);

        assertThat(report.insufficientData()).isTrue();
        // TTFB 缺样本记 0 分：15 权重不计入
        assertThat(report.healthScore()).isEqualTo(85.0);
        assertThat(report.metrics().get(4).metric()).isEqualTo("TTFB");
        assertThat(report.metrics().get(4).p75()).isNull();
    }

    @Test
    void windowBoundsAreEchoedBack() {
        SloReport report = service.evaluate(allMet(), start, end);
        assertThat(report.windowStart()).isEqualTo(start);
        assertThat(report.windowEnd()).isEqualTo(end);
    }

    @Test
    void currentReadsRollingWindowFromRepository() {
        when(eventRepository.percentileByMetric(any(), any())).thenReturn(allMet());

        SloReport report = service.current();

        assertThat(report.healthScore()).isEqualTo(100.0);
        assertThat(report.windowEnd()).isAfter(report.windowStart());
        // 默认 24 小时窗口（TelemetryProperties.sloWindowHours）
        assertThat(java.time.Duration.between(report.windowStart(), report.windowEnd()).toHours()).isEqualTo(24);
    }

    @Test
    void snapshotWritesOneRowPerMetricForPreviousWindow() {
        when(eventRepository.percentileByMetric(any(), any()))
                .thenReturn(List.of(row("LCP", 3000, 4), row("INP", 100, 4)));

        int written = service.snapshotPreviousWindow();

        // 五个指标全落行（无样本也落 sample_count=0），窗口长度固定 15 分钟
        assertThat(written).isEqualTo(5);
        verify(snapshotRepository, times(5))
                .upsertWindow(any(), any(), any(), any(), anyInt(), anyDouble(), anyBoolean());
    }
}
