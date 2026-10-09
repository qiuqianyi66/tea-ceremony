package com.tea.ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * AI 评测四层归因 Trace（ai_eval_traces 表，V5 迁移，ADR-016）。
 * 字段与 V5__ai_eval_traces.sql 严格对齐（ddl-auto: validate）。
 * JSONB 层存 Jackson 序列化 JSON 文本（input 必填，context 默认 {}）；session_id 游客可空。
 */
@Entity
@Getter
@Setter
@Table(name = "ai_eval_traces")
public class AiEvalTrace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id")
    private Integer sessionId;

    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "agent_type", length = 32)
    private String agentType;

    @Column(name = "input_layer", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String inputLayer;

    @Column(name = "context_layer", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String contextLayer;

    @Column(name = "plan_layer", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String planLayer;

    @Column(name = "exec_layer", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String execLayer;

    @Column(name = "output")
    private String output;

    @Column(name = "tokens_in")
    private Integer tokensIn = 0;

    @Column(name = "tokens_out")
    private Integer tokensOut = 0;

    @Column(name = "latency_ms")
    private Integer latencyMs = 0;

    @Column(name = "error_code", length = 32)
    private String errorCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
