package com.tea.ai.experiment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A/B 实验（ab_experiments 表，V9 迁移）。字段与 V9__ab_experiments.sql 严格对齐（ddl-auto: validate）。
 *
 * 只存实验配置与最近一次评估结果；**不存 assignment**——分桶是确定性哈希，
 * 没有「谁被分到哪组」这类需要持久化的状态。
 *
 * JSONB 两列存 Jackson 序列化 JSON 文本（与 AiEvalTrace 同一映射方式）：
 * variants = {"control":{...},"treatment":{...}}，guardrail = {maxErrorRateDelta,maxP99Ratio,minSampleSize}。
 * updated_at 由应用层写入（@PreUpdate），与既有表一致，未加数据库触发器。
 */
@Entity
@Getter
@Setter
@Table(name = "ab_experiments")
public class AbExperiment {

    /** 与 V9 的 CHECK 约束逐字一致；外置成常量避免各处散落魔法字符串。 */
    public static final String STATUS_DRAFT = "draft";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_PAUSED = "paused";
    public static final String STATUS_STOPPED = "stopped";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "exp_key", nullable = false, length = 64)
    private String expKey;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "status", nullable = false, length = 16)
    private String status = STATUS_DRAFT;

    /** SMALLINT：用 Short 而非 Integer，否则 Hibernate validate 会因 int4 与 int2 不匹配拒绝启动。 */
    @Column(name = "traffic_percent", nullable = false)
    private Short trafficPercent = 10;

    @Column(name = "variants", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String variants = "{}";

    @Column(name = "guardrail", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String guardrail = "{}";

    @Column(name = "sample_size", nullable = false)
    private Integer sampleSize = 0;

    @Column(name = "last_evaluated_at")
    private LocalDateTime lastEvaluatedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "stopped_at")
    private LocalDateTime stoppedAt;

    @Column(name = "stop_reason", length = 256)
    private String stopReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** 占比的 int 视图：列是 SMALLINT（可空映射），业务判断统一走这里，避免各处 Short 拆箱。 */
    public int trafficPercentValue() {
        return trafficPercent == null ? 0 : trafficPercent;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
