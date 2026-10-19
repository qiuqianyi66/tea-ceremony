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
 * **trace 侧写入约定**（2026-10-19 起多实验）：{@code plan_layer.experiments} 是
 * {@code {"<expKey>": "control|treatment"}}，一次请求可归属多个实验；
 * 历史行只带顶层 {@code variant} + {@code experiment}，由本文件 SQL 的 COALESCE 分支兜住。
 * 缺归属键的行不进入任何实验的分组（宁可少算也不把流量算给错误的实验），见 ExperimentService#variantsOf。
 */
public interface AbExperimentRepository extends JpaRepository<AbExperiment, Long> {

    Optional<AbExperiment> findByExpKey(String expKey);

    List<AbExperiment> findByStatus(String status);

    /** 概览按 exp_key 排序：接口输出顺序稳定，前端不必二次排序。 */
    List<AbExperiment> findAllByOrderByExpKeyAsc();

    /**
     * 窗口内某实验按变体分组的调用数 / 失败数 / P99。
     * 行 = [variant(String), calls(Long), error_calls(Long), p99(Double)]。
     * 时间参数显式 cast timestamptz：created_at 是 timestamptz，原生查询不做参数类型推断（同 AiEvalTraceRepository）。
     *
     * <p>为什么按 exp_key 逐个查：归属写在 {@code plan_layer.experiments} 这个 JSONB 对象里，
     * 键是动态的。要么在 SQL 里展开所有键（lateral jsonb_each），要么把键作为参数传入。
     * 传参的写法让「属谁」只有一处定义——COALESCE 的两个分支——统计口径不会随写入形态演进失配。
     * 实验数量是个位数，多一次索引扫描换来规则可读，值得。</p>
     *
     * <p>变体取值顺序：先看 {@code experiments[expKey]}（新格式）；没有再看
     * 「顶层 experiment 等于本键时」的顶层 variant（历史单实验行）。两者都没有的行不参与分组。</p>
     */
    @Query(value = "select s.variant as variant, "
            + "count(*) as calls, "
            + "count(*) filter (where s.error_code is not null) as error_calls, "
            + "percentile_cont(0.99) within group (order by s.latency_ms) as p99 "
            + "from (select coalesce(t.plan_layer -> 'experiments' ->> :expKey, "
            + "case when t.plan_layer ->> 'experiment' = :expKey then t.plan_layer ->> 'variant' end) as variant, "
            + "t.error_code, t.latency_ms "
            + "from ai_eval_traces t "
            + "where t.created_at >= cast(:start as timestamptz) and t.created_at < cast(:end as timestamptz)) s "
            // 变体过滤放在外层：与改造前 plan_layer->>'variant' in (...) 同一语义，只对 control/treatment 计数
            + "where s.variant in ('control', 'treatment') "
            + "group by 1", nativeQuery = true)
    List<Object[]> variantWindowStats(@Param("expKey") String expKey,
                                      @Param("start") LocalDateTime start,
                                      @Param("end") LocalDateTime end);
}
