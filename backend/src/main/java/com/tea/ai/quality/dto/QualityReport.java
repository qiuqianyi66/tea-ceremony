package com.tea.ai.quality.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI 回答质量报告（GET /api/v1/ai/metrics/quality）。
 *
 * 口径（唯一解释点，别在别处二次解释；与 {@link com.tea.ai.dto.GoldenMetricsReport} 同风格）：
 * 1. 维度均值 = ai_eval_traces.quality_layer 里对应键的平均值，只统计已评分行；
 * 2. 总分 overallAvg = 四维均值（每条 trace 先算 overall，再对 overall 求均值——不是四个均值再平均，
 *    两者在样本缺失维度时不同，这里取前者，与 judge 的 overall 定义一致）；
 * 3. 覆盖率 coverage = 已评分 trace 数 / 窗口内成功 trace 总数（success = error_code IS NULL）；
 * 4. 分 agent 维度均值：只列至少有一条已评分的 agent（没评分的 agent 均值无定义，不输出 0）。
 *
 * 零样本：averages / overallP50 全部 null（不是 0）——0 分会被看板读成「答得极差」，
 * 而真相是「窗口内还没人评分」（评分是定时抽样，滞后是常态）；coverage 在 totalTraces=0 时为 null。
 *
 * insufficientData：已评分样本 < 20（与黄金指标同一个统计门槛）。此时仍给均值（方向性参考），
 * 但 overallP50 置 null：十几个样本的中位数会被单条异常分带偏，报出来诱导误判。
 *
 * 为什么没有 P99 之类：质量分是 1-5 的离散区间，分位数只能给中位数这种稳健指标；
 * 尾部（1 分）本来就该逐条看 trace，报表只回答「整体趋势好不好」。
 */
public record QualityReport(
        LocalDateTime windowStart,
        LocalDateTime windowEnd,
        long totalTraces,
        long judgedTraces,
        Double coverage,
        Double relevanceAvg,
        Double groundednessAvg,
        Double actionabilityAvg,
        Double toneAvg,
        Double overallAvg,
        Double overallP50,
        boolean insufficientData,
        List<AgentQuality> byAgent) {

    /**
     * 单个 agent 的质量指标。
     * 为什么没有一条全局的 "all" 行：顶层字段本身就是全窗口聚合，再复制一份只会让前端要判断
     * 「哪一行是 overall」；分 agent 只列有评分的 agent，空分组不出现。
     */
    public record AgentQuality(
            String agentType,
            long judgedTraces,
            Double relevanceAvg,
            Double groundednessAvg,
            Double actionabilityAvg,
            Double toneAvg,
            Double overallAvg,
            Double overallP50,
            boolean insufficientData) {
    }
}
