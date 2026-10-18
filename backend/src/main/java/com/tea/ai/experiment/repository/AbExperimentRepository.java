package com.tea.ai.experiment.repository;

import com.tea.ai.experiment.entity.AbExperiment;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * A/B 实验仓储（ab_experiments）+ 变体指标对比原生 SQL。
 *
 * 对比查询为什么下推 Postgres：窗口内 trace 可能上万行，拉进 JVM 再按变体分组、排序取分位不可接受；
 * percentile_cont(0.99) 必须在库侧算，口径才与 GoldenMetricsService 的 P99 一致。
 *
 * **trace 侧写入约定**：plan_layer 需带 {@code variant=control|treatment}（必需）；
 * {@code experiment=<exp_key>} 为多实验并行时的归属键——缺失的行只在「唯一 running 实验」时被计入，
 * 否则忽略（宁可少算也不把流量算给错误的实验），见 ExperimentService#variantsOf。
 * 缺 variant 的行一律不计入任何一组。
 */
public interface AbExperimentRepository extends JpaRepository<AbExperiment, Long> {

    Optional<AbExperiment> findByExpKey(String expKey);

    List<AbExperiment> findByStatus(String status);

    /** 概览按 exp_key 排序：接口输出顺序稳定，前端不必二次排序。 */
    List<AbExperiment> findAllByOrderByExpKeyAsc();

    /**
     * 窗口内按 (实验, 变体) 分组的调用数 / 失败数 / P99。
     * 行 = [exp_key(String 或 null), variant(String), calls(Long), error_calls(Long), p99(Double)]。
     * 时间参数显式 cast timestamptz：created_at 是 timestamptz，原生查询不做参数类型推断（同 AiEvalTraceRepository）。
     *
     * exp_key 允许为 null：写入侧（TraceRecorder）目前只把 variant 写进 plan_layer，
     * 「未标注实验」的行由 Service 层决定归属（唯一 running 实验时才计入，见 ExperimentService#variantsOf）。
     * 这样既能在当前写入形态下出数，也不会在多个实验并行时把流量算给错误的实验。
     */
    @Query(value = "select plan_layer->>'experiment' as exp_key, "
            + "plan_layer->>'variant' as variant, "
            + "count(*) as calls, "
            + "count(*) filter (where error_code is not null) as error_calls, "
            + "percentile_cont(0.99) within group (order by latency_ms) as p99 "
            + "from ai_eval_traces "
            + "where created_at >= cast(:start as timestamptz) and created_at < cast(:end as timestamptz) "
            + "and plan_layer->>'variant' in ('control', 'treatment') "
            + "group by 1, 2", nativeQuery = true)
    List<Object[]> variantWindowStats(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
