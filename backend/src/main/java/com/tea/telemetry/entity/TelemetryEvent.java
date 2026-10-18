package com.tea.telemetry.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * 遥测原始事件（telemetry_events 表，V8 迁移，ADR-022）。
 * 字段与 V8__telemetry.sql 逐字对齐（ddl-auto: validate）。
 * 写入走 Repository 的 ON CONFLICT DO NOTHING 原生语句（契约 §9 指定的幂等方式），
 * 本实体只承载读取与参数传递：并发重复上报不会因唯一约束异常把整批事务打回滚。
 */
@Entity
@Getter
@Setter
@Table(name = "telemetry_events")
public class TelemetryEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_event_id", nullable = false)
    private UUID clientEventId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "app_version", length = 32)
    private String appVersion;

    @Column(name = "event_type", nullable = false, length = 16)
    private String eventType;

    @Column(name = "route", length = 128)
    private String route;

    @Column(name = "fingerprint", length = 32)
    private String fingerprint;

    @Column(name = "message")
    private String message;

    @Column(name = "stack")
    private String stack;

    @Column(name = "source_file", length = 256)
    private String sourceFile;

    @Column(name = "line_no")
    private Integer lineNo;

    @Column(name = "col_no")
    private Integer colNo;

    @Column(name = "metric_name", length = 16)
    private String metricName;

    @Column(name = "metric_value")
    private Double metricValue;

    @Column(name = "metric_rating", length = 24)
    private String metricRating;

    @Column(name = "occurred_at", nullable = false)
    private LocalDateTime occurredAt;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;
}
