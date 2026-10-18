package com.tea.ai.quality;

import com.tea.ai.quality.dto.QualityReport;
import com.tea.ai.quality.dto.QualityReport.AgentQuality;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 质量指标聚合（GET /api/v1/ai/metrics/quality）。
 *
 * 为什么要独立于 GoldenMetricsService：黄金指标（成功率/错误率/延迟）与质量分（相关性/有据性/可操作性/语气）
 * 的数据源列、样本门槛与解读方式都不同；混进一个报告会让「成功率 100% 但答得很差」这种情况看不出来。
 *
 * 聚合全部下推 Postgres（avg / percentile_cont / FILTER）：窗口内可能上万条 trace，
 * 拉进 JVM 再算均值既慢又不许全表扫；口径只有一处（QualityTraceRepository 的原生 SQL）。
 *
 * 零样本与样本不足的口径与 GoldenMetricsReport 完全一致：
 * - 零已评分样本 → 均值/中位数全 null（不是 0），insufficientData=true；
 * - 已评分 < 20 → 均值照给（方向性参考），overallP50 置 null（少样本中位数会被单条异常分带偏）。
 */
@Service
@RequiredArgsConstructor
public class QualityMetricsService {

    /** 默认窗口 24 小时：评分是定时抽样（默认 10 分钟一批 20 条），分钟级窗口几乎必然零样本。 */
    public static final int DEFAULT_WINDOW_MINUTES = 1440;
    /** 上限 7 天：质量趋势按天看，再长应该走离线报表而不是扫 trace。 */
    public static final int MAX_WINDOW_MINUTES = 10080;
    /** 分位（中位数）的最小样本数：与 GoldenMetricsService.MIN_PERCENTILE_SAMPLES 同一门槛。 */
    public static final int MIN_SAMPLES = 20;

    private final QualityTraceRepository repository;

    @Transactional(readOnly = true)
    public QualityReport quality(int windowMinutes) {
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusMinutes(normalizeWindow(windowMinutes));
        return build(repository.windowQualityOverall(start, end),
                repository.windowQualityByAgent(start, end), start, end);
    }

    /**
     * 行 → 报告（纯函数：入参即全部输入，不读时钟不读库，便于逐条断言口径）。
     * overallRows 行 = [total, judged, relevance, groundedness, actionability, tone, overall, p50]；
     * agentRows 行 = [agent_type, judged, relevance, groundedness, actionability, tone, overall, p50]。
     */
    public QualityReport build(List<Object[]> overallRows, List<Object[]> agentRows,
                               LocalDateTime start, LocalDateTime end) {
        long total = 0;
        long judged = 0;
        Double relevance = null;
        Double groundedness = null;
        Double actionability = null;
        Double tone = null;
        Double overall = null;
        Double p50 = null;
        if (overallRows != null) {
            for (Object[] row : overallRows) {
                if (row == null || row.length < 8) {
                    continue;
                }
                total = longOf(row[0]);
                judged = longOf(row[1]);
                relevance = doubleOrNull(row[2]);
                groundedness = doubleOrNull(row[3]);
                actionability = doubleOrNull(row[4]);
                tone = doubleOrNull(row[5]);
                overall = doubleOrNull(row[6]);
                p50 = doubleOrNull(row[7]);
                break; // 聚合查询无 group by，最多一行；多余行是异常数据，取首行而不是求和
            }
        }
        List<AgentQuality> byAgent = new ArrayList<>();
        if (agentRows != null) {
            for (Object[] row : agentRows) {
                if (row == null || row.length < 8) {
                    continue;
                }
                long agentJudged = longOf(row[1]);
                if (agentJudged <= 0) {
                    continue; // 没评分的 agent 均值无定义：输出 0 会被读成「答得极差」
                }
                boolean agentInsufficient = agentJudged < MIN_SAMPLES;
                byAgent.add(new AgentQuality(
                        row[0] == null ? "unknown" : String.valueOf(row[0]),
                        agentJudged,
                        score(doubleOrNull(row[2])), score(doubleOrNull(row[3])),
                        score(doubleOrNull(row[4])), score(doubleOrNull(row[5])),
                        score(doubleOrNull(row[6])),
                        agentInsufficient ? null : score(doubleOrNull(row[7])),
                        agentInsufficient));
            }
        }
        boolean insufficientData = judged < MIN_SAMPLES;
        return new QualityReport(start, end, total, judged, coverage(total, judged),
                score(relevance), score(groundedness), score(actionability), score(tone),
                score(overall),
                insufficientData ? null : score(p50),
                insufficientData, byAgent);
    }

    /** 窗口参数归一：非正数回落默认值，超上限截断（报表参数不该把接口打成 400，与黄金指标同处理）。 */
    public static int normalizeWindow(int windowMinutes) {
        if (windowMinutes <= 0) {
            return DEFAULT_WINDOW_MINUTES;
        }
        return Math.min(windowMinutes, MAX_WINDOW_MINUTES);
    }

    /** 覆盖率：零分母返回 null；保留 3 位（0.123 与 GoldenMetricsReport 的 rate 精度一致）。 */
    static Double coverage(long total, long judged) {
        return total <= 0 ? null : round(judged / (double) total, 3);
    }

    /** 维度均值：无样本返回 null；保留 2 位（1-5 分尺度上 0.01 已是可行动精度）。 */
    static Double score(Double value) {
        return value == null ? null : round(value, 2);
    }

    private static long longOf(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static Double doubleOrNull(Object value) {
        return value instanceof Number number ? number.doubleValue() : null;
    }

    /** 与 GoldenMetricsService 同一舍入风格（四舍五入到 digits 位）。 */
    private static double round(double value, int digits) {
        double scale = Math.pow(10, digits);
        return Math.round(value * scale) / scale;
    }
}
