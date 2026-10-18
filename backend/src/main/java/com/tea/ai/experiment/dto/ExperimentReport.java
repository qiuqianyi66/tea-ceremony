package com.tea.ai.experiment.dto;

/**
 * 单实验的「配置 + 双轨对比」报告。
 *
 * sufficientSample=false 表示任一组窗口内样本 < guardrail.minSampleSize：
 * 此时指标照常给出（便于人工看趋势），但自动回滚不会据此判断——少样本的差值/比值不稳。
 */
public record ExperimentReport(
        ExperimentView experiment,
        GuardrailConfig guardrail,
        VariantMetrics control,
        VariantMetrics treatment,
        boolean sufficientSample) {
}
