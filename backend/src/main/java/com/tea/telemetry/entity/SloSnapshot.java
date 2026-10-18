package com.tea.telemetry.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * SLO 15 分钟窗口快照（slo_snapshots 表，V8 迁移，ADR-022）。
 * 字段与 V8__telemetry.sql 逐字对齐（ddl-auto: validate）。
 * slo_target 快照当时的目标值：目标调整后历史快照仍可解释，不必回头重算。
 */
@Entity
@Getter
@Setter
@Table(name = "slo_snapshots")
public class SloSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "window_start", nullable = false)
    private LocalDateTime windowStart;

    @Column(name = "window_end", nullable = false)
    private LocalDateTime windowEnd;

    @Column(name = "metric", nullable = false, length = 16)
    private String metric;

    @Column(name = "p75")
    private Double p75;

    @Column(name = "sample_count", nullable = false)
    private int sampleCount;

    @Column(name = "slo_target", nullable = false)
    private double sloTarget;

    @Column(name = "slo_met", nullable = false)
    private boolean sloMet;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
