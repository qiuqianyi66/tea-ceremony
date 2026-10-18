package com.tea.ai.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * AI 三大黄金指标报告（生产级 Agent 的固定观测面）。
 *
 * 口径（唯一解释点，别在别处二次解释）：
 * 1. Task Success Rate = successRate：成功调用数 / 总调用数。成功 = ai_eval_traces.error_code IS NULL。
 * 2. Tool Call Error Rate = errorRate：失败调用数 / 总调用数。失败 = error_code IS NOT NULL（含 502 降级）。
 * 3. P99 Latency = p99：percentile_cont(0.99) within group (order by latency_ms)，同时给 p50/p95。
 *
 * 零调用：successRate / errorRate 恒为 null（没有分母就不编造 0），percentile 全 null，
 * insufficientData=true。选 null 不选 0 的原因：0 分成功率会被看板读成「全线故障」，
 * 而真相是「窗口内没有 AI 调用」——两种状态必须可区分。
 *
 * insufficientData：窗口内样本数 < 20（SloEvaluationService 之外的另一处统计门槛）。
 * 此时仍然返回 p50/p95（少样本下中位数/高位分位仍有参考性），但 p99 置 null：
 * 十来个样本的 99 分位实际等于最大值，报出来会诱导按「尾延迟劣化」误判。
 */
public record GoldenMetricsReport(
        LocalDateTime windowStart,
        LocalDateTime windowEnd,
        long totalCalls,
        AgentMetrics overall,
        List<AgentMetrics> byAgent) {

    /**
     * 单维度指标（overall 与 byAgent 共用同一形状，前端不必写两套渲染）。
     * agentType：overall 固定为 "all"；byAgent 取 ai_eval_traces.agent_type。
     * 延迟单位毫秒（与 latency_ms 列一致），保留 1 位小数。
     */
    public record AgentMetrics(
            String agentType,
            long calls,
            Double successRate,
            Double errorRate,
            Double p50,
            Double p95,
            Double p99,
            boolean insufficientData) {
    }
}
