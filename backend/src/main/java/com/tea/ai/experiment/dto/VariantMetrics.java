package com.tea.ai.experiment.dto;

/**
 * 单个变体在评估窗口内的指标（control / treatment 同形状，前端不必写两套渲染）。
 *
 * 口径与 GoldenMetricsService 对齐：
 * 1. errorRate = 失败调用数 / 调用数，零样本为 **null 而非 0**——0 会被看板读成「这条路径全好」，
 *    而真相是窗口内这组没有流量，两种状态必须可区分；
 * 2. p99 = percentile_cont(0.99)，单位毫秒；样本 < 20 时为 null（少样本的 99 分位等于最大值，
 *    报出来会诱导按尾延迟劣化误判），判断门槛另由 {@link GuardrailConfig#minSampleSize()} 兜。
 */
public record VariantMetrics(String variant, long calls, Double errorRate, Double p99) {

    /** 窗口内该变体零流量：各指标留空，不做 0 填充。 */
    public static VariantMetrics empty(String variant) {
        return new VariantMetrics(variant, 0L, null, null);
    }
}
