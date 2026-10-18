package com.tea.ai.repository;

import com.tea.ai.entity.AiEvalTrace;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * AI 评测 Trace 仓储（ai_eval_traces；append-only，无更新路径）。
 * 黄金指标的两条聚合查询走原生 SQL：
 * - 分位必须由 Postgres 算（percentile_cont）：trace 按调用量增长，把窗口样本拉进 JVM 排序取分位不可接受；
 * - 计数与分位放在同一条 SQL：同一次查询快照内的分子分母才自洽，也少一次 round trip；
 * - 时间参数显式 cast timestamptz：created_at 是 timestamptz，原生查询的 null/参数类型不做推断。
 */
public interface AiEvalTraceRepository extends JpaRepository<AiEvalTrace, Long> {

    /**
     * 窗口内按 agent_type 分组的调用数 / 成功数 / 失败数 + 延迟分位。
     * 行 = [agent_type(String), calls(Long), success_calls(Long), error_calls(Long),
     * p50(Double), p95(Double), p99(Double)]，按 calls 倒序（报表要能一眼看到流量最大的 agent）。
     */
    @Query(value = "select agent_type, count(*) as calls, "
            + "count(*) filter (where error_code is null) as success_calls, "
            + "count(*) filter (where error_code is not null) as error_calls, "
            + "percentile_cont(0.5) within group (order by latency_ms) as p50, "
            + "percentile_cont(0.95) within group (order by latency_ms) as p95, "
            + "percentile_cont(0.99) within group (order by latency_ms) as p99 "
            + "from ai_eval_traces "
            + "where created_at >= cast(:start as timestamptz) and created_at < cast(:end as timestamptz) "
            + "group by agent_type "
            + "order by calls desc, agent_type", nativeQuery = true)
    List<Object[]> windowStatsByAgent(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /**
     * 全窗口汇总（跨 agent）。聚合查询无 group by，窗口内零调用时也返回一行（count=0、分位 null），
     * 这样「没调用」和「调用查不到」在结果上可以区分开。
     * 行 = [calls(Long), success_calls(Long), error_calls(Long), p50(Double), p95(Double), p99(Double)]。
     */
    @Query(value = "select count(*) as calls, "
            + "count(*) filter (where error_code is null) as success_calls, "
            + "count(*) filter (where error_code is not null) as error_calls, "
            + "percentile_cont(0.5) within group (order by latency_ms) as p50, "
            + "percentile_cont(0.95) within group (order by latency_ms) as p95, "
            + "percentile_cont(0.99) within group (order by latency_ms) as p99 "
            + "from ai_eval_traces "
            + "where created_at >= cast(:start as timestamptz) and created_at < cast(:end as timestamptz)",
            nativeQuery = true)
    List<Object[]> windowStatsOverall(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
