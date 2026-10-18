package com.tea.ai.metrics;

import com.tea.ai.dto.GoldenMetricsReport;
import com.tea.ai.dto.GoldenMetricsReport.AgentMetrics;
import com.tea.ai.repository.AiEvalTraceRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 三大黄金指标（Task Success Rate / Tool Call Error Rate / P99 Latency）。
 *
 * 为什么数据源是 ai_eval_traces 而不是 ai_usage_logs：usage_logs 只记成功调用（失败在 TraceRecorder.fail 侧），
 * 拿它算成功率永远 100%；只有 trace 表成功/降级都落一行，错误率才可算。
 *
 * 口径（唯一解释点，与 {@link GoldenMetricsReport} javadoc 一致）：
 * 1. Task Success Rate = error_code IS NULL 的行数 / 窗口内总行数，按 agent_type 分组；
 * 2. Tool Call Error Rate = error_code IS NOT NULL 的行数 / 总行数（含 502 降级 BAD_GATEWAY）；
 * 3. P99 Latency = percentile_cont(0.99) within group (order by latency_ms)，同时给 P50/P95。
 *
 * 聚合全部下推 Postgres：窗口内可能上万行，拉进 JVM 再排序算分位不可接受，也不许全表扫描。
 *
 * 零调用：successRate / errorRate 返回 null（不是 0，理由见 DTO javadoc），insufficientData=true。
 * 样本 < {@link #MIN_PERCENTILE_SAMPLES}：p99 置 null（少样本的 99 分位等于最大值，无统计意义），
 * 但 p50/p95 照常返回——中位数在 5 个样本上仍有参考价值。
 */
@Service
@RequiredArgsConstructor
public class GoldenMetricsService {

    /** 默认窗口 60 分钟：AI 调用是稀疏流量，分钟级窗口基本都会落到 insufficientData。 */
    public static final int DEFAULT_WINDOW_MINUTES = 60;
    /** 窗口上限 24 小时：更长的跨度应走 ai_usage_logs 的日聚合，不在这里扫 trace。 */
    public static final int MAX_WINDOW_MINUTES = 1440;
    /** P99 的最小样本数：低于此值只给 P50/P95。 */
    public static final int MIN_PERCENTILE_SAMPLES = 20;
    /** overall 行的 agentType 标签（与真实 agent_type 值不会冲突）。 */
    static final String OVERALL_LABEL = "all";

    private final AiEvalTraceRepository repository;

    /** GET /api/v1/ai/metrics/golden：滚动窗口内的三大指标。 */
    @Transactional(readOnly = true)
    public GoldenMetricsReport golden(int windowMinutes) {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusMinutes(normalizeWindow(windowMinutes));
        return build(repository.windowStatsByAgent(start, end),
                repository.windowStatsOverall(start, end), start, end);
    }

    /**
     * 行 → 报告（纯函数：入参即全部输入，不读时钟不读库，便于逐条断言口径）。
     * agentRows 行结构：[agent_type, calls, success_calls, error_calls, p50, p95, p99]；
     * overallRows 行结构：[calls, success_calls, error_calls, p50, p95, p99]（由 Repository 原生 SQL 决定）。
     */
    public GoldenMetricsReport build(List<Object[]> agentRows, List<Object[]> overallRows,
                                     LocalDateTime start, LocalDateTime end) {
        List<AgentMetrics> byAgent = new ArrayList<>();
        if (agentRows != null) {
            for (Object[] row : agentRows) {
                if (row == null || row.length < 7) {
                    continue;
                }
                // agent_type 在库里 NOT NULL；null 只可能来自非常规数据修复，标 unknown 而不是丢行
                byAgent.add(metrics(row[0] == null ? "unknown" : String.valueOf(row[0]),
                        longOf(row[1]), longOf(row[2]), longOf(row[3]),
                        doubleOrNull(row[4]), doubleOrNull(row[5]), doubleOrNull(row[6])));
            }
        }
        AgentMetrics overall = overallOf(overallRows);
        return new GoldenMetricsReport(start, end, overall.calls(), overall, byAgent);
    }

    /** 窗口参数归一：非正数回落默认值，超上限截断（不抛异常——报表参数不该把接口打成 400）。 */
    public static int normalizeWindow(int windowMinutes) {
        if (windowMinutes <= 0) {
            return DEFAULT_WINDOW_MINUTES;
        }
        return Math.min(windowMinutes, MAX_WINDOW_MINUTES);
    }

    private AgentMetrics overallOf(List<Object[]> overallRows) {
        if (overallRows != null) {
            for (Object[] row : overallRows) {
                if (row != null && row.length >= 6) {
                    return metrics(OVERALL_LABEL, longOf(row[0]), longOf(row[1]), longOf(row[2]),
                            doubleOrNull(row[3]), doubleOrNull(row[4]), doubleOrNull(row[5]));
                }
            }
        }
        // 查询异常/空结果：按零调用处理，不编造分位
        return metrics(OVERALL_LABEL, 0, 0, 0, null, null, null);
    }

    private static AgentMetrics metrics(String agentType, long calls, long successCalls, long errorCalls,
                                        Double p50, Double p95, Double p99) {
        boolean insufficientData = calls < MIN_PERCENTILE_SAMPLES;
        return new AgentMetrics(agentType, calls,
                rate(successCalls, calls), rate(errorCalls, calls),
                percentile(p50, calls), percentile(p95, calls),
                insufficientData ? null : percentile(p99, calls),
                insufficientData);
    }

    /** 比率：零分母返回 null（没有调用就没有成功率，0 会被误读成全挂）。 */
    static Double rate(long numerator, long denominator) {
        return denominator <= 0 ? null : round(numerator / (double) denominator, 3);
    }

    /** 分位值：无样本返回 null；延迟保留 1 位小数（亚毫秒精度对 SLO 判断无意义）。 */
    static Double percentile(Double value, long calls) {
        return value == null || calls <= 0 ? null : round(value, 1);
    }

    private static long longOf(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static Double doubleOrNull(Object value) {
        return value instanceof Number number ? number.doubleValue() : null;
    }

    /** 与 SloEvaluationService 同一舍入风格（四舍五入到 digits 位）。 */
    private static double round(double value, int digits) {
        double scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale;
    }
}
