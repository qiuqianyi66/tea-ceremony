package com.tea.ai.quality;

import com.tea.ai.entity.AiEvalTrace;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * 质量评分的读写入口（ai_eval_traces 的 quality_layer 列）。
 *
 * 为什么单独一个仓储而不是往 AiEvalTraceRepository 里加方法：
 * 那个仓储的 javadoc 明确「append-only，无更新路径」，是黄金指标的口径来源；
 * 质量评分是唯一会 UPDATE trace 的组件，把写路径圈在自己的仓储里，读侧口径不被污染。
 *
 * 口径映射（与 GoldenMetricsService 一致）：
 * - 「status='success'」在库里没有 status 列，等价条件是 error_code IS NULL（失败落 BAD_GATEWAY/ERROR）；
 * - 「已评分」= quality_layer IS NOT NULL。
 */
public interface QualityTraceRepository extends JpaRepository<AiEvalTrace, Long> {

    /**
     * 取一批待评分 trace：成功、未评分、有正文，按 created_at 升序（先清历史积压，避免新流量把旧数据饿死）。
     * 走部分索引 idx_eval_traces_unjudged（V10），不会随已评分历史变慢。
     */
    @Query(value = "select * from ai_eval_traces "
            + "where error_code is null and quality_layer is null "
            + "and output is not null and length(output) > 0 "
            + "order by created_at asc limit :limit", nativeQuery = true)
    List<AiEvalTrace> findUnjudged(@Param("limit") int limit);

    /**
     * 写入评分。
     *
     * 为什么带 quality_layer is null 守卫：幂等靠库保证而不是靠先查后写——
     * 多实例同时跑定时任务时，「查到未评分」到「写入」之间必然有竞态；
     * 守卫让后到的那次更新影响 0 行，天然幂等，也不需要悲观锁。
     *
     * @return 实际更新行数（0 = 已被别的实例评过，跳过计数）
     */
    @Modifying
    @Transactional(rollbackFor = Exception.class)
    @Query(value = "update ai_eval_traces set quality_layer = cast(:layer as jsonb) "
            + "where id = :id and quality_layer is null", nativeQuery = true)
    int saveQuality(@Param("id") Long id, @Param("layer") String layer);

    /**
     * 窗口内全量汇总：总成功 trace 数、已评分条数、四维与总分均值、总分中位数。
     * 行 = [total(Long), judged(Long), relevance(Double), groundedness(Double),
     *      actionability(Double), tone(Double), overall(Double), p50(Double)]
     *
     * 为什么聚合全部下推 Postgres：trace 按调用量增长，把窗口样本拉进 JVM 再算均值/分位不可接受；
     * 为什么要过滤 quality_layer 再取键：NULL 行的 ->> 结果是 NULL，avg 本来会忽略，
     * 但 percentile_cont 的有序集必须显式 FILTER，否则 NULL 会进入排序。
     */
    @Query(value = "select count(*) as total_traces, "
            + "count(*) filter (where quality_layer is not null) as judged_traces, "
            + "avg((quality_layer->>'relevance')::double precision) as relevance_avg, "
            + "avg((quality_layer->>'groundedness')::double precision) as groundedness_avg, "
            + "avg((quality_layer->>'actionability')::double precision) as actionability_avg, "
            + "avg((quality_layer->>'tone')::double precision) as tone_avg, "
            + "avg((quality_layer->>'overall')::double precision) as overall_avg, "
            + "percentile_cont(0.5) within group (order by (quality_layer->>'overall')::double precision) "
            + "filter (where quality_layer is not null) as overall_p50 "
            + "from ai_eval_traces "
            + "where error_code is null "
            + "and created_at >= cast(:start as timestamptz) and created_at < cast(:end as timestamptz)",
            nativeQuery = true)
    List<Object[]> windowQualityOverall(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /**
     * 窗口内按 agent_type 分组的质量指标（只返回至少有一条已评分的 agent）。
     * 行 = [agent_type(String), judged(Long), relevance, groundedness, actionability, tone, overall, p50]。
     * order by 用完整聚合表达式而不是别名，避免依赖 Postgres 的别名解析顺序。
     */
    @Query(value = "select agent_type, "
            + "count(*) filter (where quality_layer is not null) as judged_traces, "
            + "avg((quality_layer->>'relevance')::double precision) as relevance_avg, "
            + "avg((quality_layer->>'groundedness')::double precision) as groundedness_avg, "
            + "avg((quality_layer->>'actionability')::double precision) as actionability_avg, "
            + "avg((quality_layer->>'tone')::double precision) as tone_avg, "
            + "avg((quality_layer->>'overall')::double precision) as overall_avg, "
            + "percentile_cont(0.5) within group (order by (quality_layer->>'overall')::double precision) "
            + "filter (where quality_layer is not null) as overall_p50 "
            + "from ai_eval_traces "
            + "where error_code is null "
            + "and created_at >= cast(:start as timestamptz) and created_at < cast(:end as timestamptz) "
            + "group by agent_type "
            + "having count(*) filter (where quality_layer is not null) > 0 "
            + "order by count(*) filter (where quality_layer is not null) desc, agent_type",
            nativeQuery = true)
    List<Object[]> windowQualityByAgent(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
