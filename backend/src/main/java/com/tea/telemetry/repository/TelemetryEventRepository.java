package com.tea.telemetry.repository;

import com.tea.telemetry.entity.TelemetryEvent;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 遥测事件仓储（telemetry_events）。
 * 三条写路径都是原生 SQL：幂等插入、P75 分位、过期删除。
 * - ON CONFLICT DO NOTHING（契约 §9）：并发重复上报只丢行不抛约束异常，整批事务不会被打回滚；
 *   返回受影响行数 1/0，正好区分 accepted 与 duplicated。
 * - percentile_cont 计算下推 DB：raw 事件按天增长，不能拉全量到 JVM 排序取分位。
 * - 每个参数显式 cast：原生查询的 null 参数没有 Java 类型可推断，Postgres 会报
 *   「could not determine data type of parameter」，cast 把类型钉在 SQL 里。
 */
public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {

    @Modifying
    @Query(value = "insert into telemetry_events (client_event_id, client_id, session_id, app_version, "
            + "event_type, route, fingerprint, message, stack, source_file, line_no, col_no, "
            + "metric_name, metric_value, metric_rating, occurred_at) values ("
            + "cast(:clientEventId as uuid), cast(:clientId as uuid), cast(:sessionId as uuid), "
            + "cast(:appVersion as varchar), cast(:eventType as varchar), cast(:route as varchar), "
            + "cast(:fingerprint as varchar), cast(:message as text), cast(:stack as text), "
            + "cast(:sourceFile as varchar), cast(:lineNo as integer), cast(:colNo as integer), "
            + "cast(:metricName as varchar), cast(:metricValue as double precision), "
            + "cast(:metricRating as varchar), cast(:occurredAt as timestamptz)) "
            + "on conflict (client_event_id) do nothing", nativeQuery = true)
    int insertIfAbsent(
            @Param("clientEventId") UUID clientEventId,
            @Param("clientId") UUID clientId,
            @Param("sessionId") UUID sessionId,
            @Param("appVersion") String appVersion,
            @Param("eventType") String eventType,
            @Param("route") String route,
            @Param("fingerprint") String fingerprint,
            @Param("message") String message,
            @Param("stack") String stack,
            @Param("sourceFile") String sourceFile,
            @Param("lineNo") Integer lineNo,
            @Param("colNo") Integer colNo,
            @Param("metricName") String metricName,
            @Param("metricValue") Double metricValue,
            @Param("metricRating") String metricRating,
            @Param("occurredAt") LocalDateTime occurredAt);

    /** 每指标 P75 与样本数：行 = [metric_name(String), p75(Double), sample_count(Long)]。 */
    @Query(value = "select metric_name, "
            + "percentile_cont(0.75) within group (order by metric_value) as p75, count(*) as sample_count "
            + "from telemetry_events "
            + "where event_type = 'vital' and metric_name is not null and metric_value is not null "
            + "and occurred_at >= cast(:start as timestamptz) and occurred_at < cast(:end as timestamptz) "
            + "group by metric_name", nativeQuery = true)
    List<Object[]> percentileByMetric(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /** 保留策略：删 occurred_at 早于 cutoff 的 raw 事件（契约 §10）。 */
    @Modifying
    @Query(value = "delete from telemetry_events where occurred_at < cast(:cutoff as timestamptz)",
            nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
