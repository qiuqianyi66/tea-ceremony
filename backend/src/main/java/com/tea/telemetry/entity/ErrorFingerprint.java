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
 * 错误指纹（error_fingerprints 表，V8 迁移，ADR-022）。
 * 字段与 V8__telemetry.sql 逐字对齐（ddl-auto: validate）。
 * occurrences / last_seen_at 由 Repository 的原生 upsert 原子累加，本实体不参与计数写回，
 * 避免「读-改-写」在并发上报下丢计数。
 */
@Entity
@Getter
@Setter
@Table(name = "error_fingerprints")
public class ErrorFingerprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fingerprint", nullable = false, length = 32)
    private String fingerprint;

    @Column(name = "sample_message", nullable = false)
    private String sampleMessage;

    @Column(name = "sample_stack")
    private String sampleStack;

    @Column(name = "route", length = 128)
    private String route;

    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "occurrences", nullable = false)
    private long occurrences;

    @Column(name = "affected_sessions", nullable = false)
    private long affectedSessions;

    @Column(name = "review_status", nullable = false, length = 16)
    private String reviewStatus;

    @Column(name = "reviewed_by", length = 64)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_note")
    private String reviewNote;
}
