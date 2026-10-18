package com.tea.ai.experiment.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 自动回滚阈值（ab_experiments.guardrail JSONB 的强类型视图）。
 *
 * 为什么全带默认值：guardrail 列默认 '{}'，实验创建时通常只想改其中一项；
 * 缺键必须落到安全默认值，而不是让「漏配一项」把自动回滚永久关掉或立即误杀。
 *
 * 口径：
 * 1. maxErrorRateDelta = 0.05：treatment 错误率比 control 高出 5 个百分点即回滚；
 * 2. maxP99Ratio = 1.5：treatment 的 P99 超过 control 的 1.5 倍即回滚；
 * 3. minSampleSize = 30：任一组样本少于此值不做判断（少样本的比值全是不稳定噪声）。
 */
public record GuardrailConfig(double maxErrorRateDelta, double maxP99Ratio, int minSampleSize) {

    public static final double DEFAULT_MAX_ERROR_RATE_DELTA = 0.05;
    public static final double DEFAULT_MAX_P99_RATIO = 1.5;
    public static final int DEFAULT_MIN_SAMPLE_SIZE = 30;

    public static GuardrailConfig defaults() {
        return new GuardrailConfig(DEFAULT_MAX_ERROR_RATE_DELTA, DEFAULT_MAX_P99_RATIO, DEFAULT_MIN_SAMPLE_SIZE);
    }

    /**
     * JSONB → 强类型。空/非对象（含解析失败的 null）返回全默认值。
     * 非正数阈值视为配置错误并回落默认：负的 delta 会让任意波动都触发回滚，0 的样本门槛等于关掉保护。
     * minSampleSize 允许 0（显式关掉样本门槛是合法诉求），负数回落默认。
     */
    public static GuardrailConfig fromJson(JsonNode node) {
        if (node == null || !node.isObject()) {
            return defaults();
        }
        double delta = positiveOr(node, "maxErrorRateDelta", DEFAULT_MAX_ERROR_RATE_DELTA);
        double ratio = positiveOr(node, "maxP99Ratio", DEFAULT_MAX_P99_RATIO);
        int minSample = node.hasNonNull("minSampleSize") && node.get("minSampleSize").canConvertToInt()
                ? node.get("minSampleSize").asInt()
                : DEFAULT_MIN_SAMPLE_SIZE;
        if (minSample < 0) {
            minSample = DEFAULT_MIN_SAMPLE_SIZE;
        }
        return new GuardrailConfig(delta, ratio, minSample);
    }

    private static double positiveOr(JsonNode node, String field, double fallback) {
        if (!node.hasNonNull(field)) {
            return fallback;
        }
        JsonNode value = node.get(field);
        if (!value.isNumber()) {
            return fallback;
        }
        double parsed = value.asDouble();
        return parsed > 0 ? parsed : fallback;
    }
}
