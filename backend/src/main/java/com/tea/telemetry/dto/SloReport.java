package com.tea.telemetry.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * SLO 报告（契约 §6）。
 * insufficientData：任一指标窗口内无样本即为 true——此时健康分缺项按 0 计，
 * 报告必须能自证「分数偏低是无数据还是真超标」，不能让调用方把无样本读成达标。
 */
public record SloReport(
        LocalDateTime windowStart,
        LocalDateTime windowEnd,
        double healthScore,
        boolean insufficientData,
        List<MetricDetail> metrics) {

    /**
     * 单指标明细：p75 保留 3 位（CLS 量级小，1 位会抹平差异），达成系数与得分保留 3 位。
     * p75 可空 = 该指标无样本。
     */
    public record MetricDetail(
            String metric,
            Double p75,
            double target,
            boolean met,
            long sampleCount,
            int weight,
            double achievement,
            double score) {
    }
}
