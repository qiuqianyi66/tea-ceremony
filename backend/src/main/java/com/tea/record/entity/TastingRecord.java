package com.tea.record.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 品鉴记录（tasting_records 表，V1 迁移）。
 * 幂等键 user_id + client_id（uk_tasting_records_user_client）；评分由前端计算（scoring.ts）透明存储，后端不重算。
 * 字段与 V1__init.sql 严格对齐（ddl-auto: validate）。
 */
@Entity
@Getter
@Setter
@Table(name = "tasting_records")
public class TastingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "client_id", nullable = false, length = 64)
    private String clientId;

    @Column(name = "tea_id")
    private Integer teaId;

    @Column(name = "tea_name", nullable = false, length = 100)
    private String teaName;

    @Column(name = "brew_temp")
    private Integer brewTemp;

    @Column(name = "brew_time")
    private Integer brewTime;

    @Column(nullable = false)
    private Integer infusions = 1;

    @Column(name = "water_type", length = 20)
    private String waterType;

    @Column(name = "ware_id")
    private Integer wareId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> dimensions = new HashMap<>();

    @Column(name = "overall_score")
    private Double overallScore;

    @Column(name = "process_factor")
    private Double processFactor;

    @Column(name = "aroma_type", length = 50)
    private String aromaType;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(length = 50)
    private String weather;

    @Column(length = 50)
    private String mood;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

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
