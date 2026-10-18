package com.tea.telemetry.repository;

import com.tea.telemetry.entity.SloSnapshot;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * SLO 快照仓储（slo_snapshots）。
 * 按 (window_start, metric) 去重 upsert：定时任务可能因重启或补跑重复处理同一窗口，
 * 重复执行只能刷新同一行，不能产生两行同窗口数据（否则趋势图会翻倍）。
 */
public interface SloSnapshotRepository extends JpaRepository<SloSnapshot, Long> {

    @Modifying
    @Query(value = "insert into slo_snapshots (window_start, window_end, metric, p75, sample_count, "
            + "slo_target, slo_met) values ("
            + "cast(:windowStart as timestamptz), cast(:windowEnd as timestamptz), cast(:metric as varchar), "
            + "cast(:p75 as double precision), :sampleCount, :sloTarget, :sloMet) "
            + "on conflict (window_start, metric) do update set "
            + "window_end = excluded.window_end, "
            + "p75 = excluded.p75, "
            + "sample_count = excluded.sample_count, "
            + "slo_met = excluded.slo_met", nativeQuery = true)
    int upsertWindow(
            @Param("windowStart") LocalDateTime windowStart,
            @Param("windowEnd") LocalDateTime windowEnd,
            @Param("metric") String metric,
            @Param("p75") Double p75,
            @Param("sampleCount") int sampleCount,
            @Param("sloTarget") double sloTarget,
            @Param("sloMet") boolean sloMet);
}
