package com.tea.telemetry.service;

import com.tea.telemetry.config.TelemetryProperties;
import com.tea.telemetry.dto.SloReport;
import com.tea.telemetry.dto.SloReport.MetricDetail;
import com.tea.telemetry.repository.SloSnapshotRepository;
import com.tea.telemetry.repository.TelemetryEventRepository;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SLO 评估（契约 §6）。
 * 分位计算下推 Postgres（percentile_cont）——raw 事件按天增长，把全量样本拉到 JVM 排序取分位不可接受。
 * 评分本身是纯函数：给定 P75 与目标能算出系数与健康分，不依赖时间/DB，便于逐条断言边界。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SloEvaluationService {

    /** 超过目标 50% 以内的最低达成系数（契约 §6 下限 0.4）。 */
    private static final double MIN_PARTIAL_FACTOR = 0.4;
    /** 大幅超标（> 50%）的系数（契约 §6）。 */
    private static final double SEVERE_FACTOR = 0.2;
    /** 快照窗口长度（契约 §10：15 分钟一个窗口）。 */
    private static final int SNAPSHOT_WINDOW_MINUTES = 15;

    private final TelemetryEventRepository eventRepository;
    private final SloSnapshotRepository snapshotRepository;
    private final TelemetryProperties props;

    /** GET /api/v1/telemetry/slo：滚动窗口（默认 24 小时）内的当前达成情况。 */
    @Transactional(readOnly = true)
    public SloReport current() {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusHours(props.getSloWindowHours());
        return evaluate(eventRepository.percentileByMetric(start, end), start, end);
    }

    /**
     * 汇总成报告（纯函数：入参即全部输入，不读时钟不读库）。
     * rows 行结构由 Repository 的原生 SQL 决定：[metric_name, p75, sample_count]。
     */
    public SloReport evaluate(List<Object[]> rows, LocalDateTime start, LocalDateTime end) {
        Map<String, Sample> samples = toSamples(rows);
        List<MetricDetail> details = new ArrayList<>();
        double weightedTotal = 0;
        boolean insufficientData = false;
        for (TelemetryProperties.Metric spec : props.metricSpecs()) {
            Sample sample = samples.get(spec.getName());
            long count = sample == null ? 0 : sample.count();
            if (count <= 0) {
                // 无样本按 0 分计（契约 §6），同时打标记：不能让调用方把「没数据」读成「不达标」或「达标」
                insufficientData = true;
                details.add(new MetricDetail(spec.getName(), null, spec.getTarget(), false,
                        0, spec.getWeight(), 0.0, 0.0));
                continue;
            }
            double factor = achievementFactor(sample.p75(), spec.getTarget());
            double score = spec.getWeight() * factor;
            weightedTotal += score;
            details.add(new MetricDetail(spec.getName(), round(sample.p75(), 3), spec.getTarget(),
                    factor >= 1.0, count, spec.getWeight(), round(factor, 3), round(score, 3)));
        }
        return new SloReport(start, end, round(weightedTotal, 1), insufficientData, details);
    }

    /**
     * 契约 §6 达成系数：
     * 达标 1.0；超标 ≤50% 线性衰减到 0.75 并保底 0.4；超标 >50% 直接 0.2。
     * target <= 0 视为配置错误：按「有样本即全责」处理，避免除零抛异常打断整个报告。
     */
    public static double achievementFactor(double p75, double target) {
        if (target <= 0) {
            return p75 <= 0 ? 1.0 : SEVERE_FACTOR;
        }
        if (p75 <= target) {
            return 1.0;
        }
        double overRatio = (p75 - target) / target;
        if (overRatio <= 0.5) {
            return Math.max(MIN_PARTIAL_FACTOR, 1.0 - overRatio / 2);
        }
        return SEVERE_FACTOR;
    }

    /** 保留 n 位小数：健康分 1 位（契约 §6），分位与系数 3 位（CLS 量级小，1 位会抹平差异）。 */
    static double round(double value, int digits) {
        double scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale;
    }

    /**
     * 生成上一个完整 15 分钟窗口的快照（定时任务调用，契约 §10）。
     * 只结算已结束的窗口：当前窗口数据还在流入，提前落快照会把半窗口当整窗口。
     * 五个指标全部落行（无样本也落 sample_count=0），保证趋势图每个窗口都对得齐。
     */
    @Transactional(rollbackFor = Exception.class)
    public int snapshotPreviousWindow() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime bucketStart = now.truncatedTo(ChronoUnit.HOURS)
                .plusMinutes((now.getMinute() / SNAPSHOT_WINDOW_MINUTES) * (long) SNAPSHOT_WINDOW_MINUTES);
        LocalDateTime windowStart = bucketStart.minusMinutes(SNAPSHOT_WINDOW_MINUTES);
        LocalDateTime windowEnd = bucketStart;
        Map<String, Sample> samples = toSamples(eventRepository.percentileByMetric(windowStart, windowEnd));
        int written = 0;
        for (TelemetryProperties.Metric spec : props.metricSpecs()) {
            Sample sample = samples.get(spec.getName());
            Double p75 = sample == null ? null : sample.p75();
            int sampleCount = sample == null ? 0 : (int) sample.count();
            boolean met = sample != null && p75 <= spec.getTarget();
            snapshotRepository.upsertWindow(windowStart, windowEnd, spec.getName(),
                    p75, sampleCount, spec.getTarget(), met);
            written++;
        }
        log.info("telemetry slo snapshot written: window={} ~ {} metrics={}", windowStart, windowEnd, written);
        return written;
    }

    private Map<String, Sample> toSamples(List<Object[]> rows) {
        Map<String, Sample> samples = new HashMap<>();
        if (rows == null) {
            return samples;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 3 || row[0] == null) {
                continue;
            }
            String metric = String.valueOf(row[0]);
            double p75 = row[1] instanceof Number number ? number.doubleValue() : 0.0;
            long count = row[2] instanceof Number number ? number.longValue() : 0L;
            samples.put(metric, new Sample(p75, count));
        }
        return samples;
    }

    /** 单指标窗口样本：P75 + 样本数。 */
    private record Sample(double p75, long count) {
    }
}
