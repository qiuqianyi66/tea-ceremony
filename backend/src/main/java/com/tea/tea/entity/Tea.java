package com.tea.tea.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 茶叶主表（teas 表，V1 迁移 + V2 文化种子）。
 * 字段与 V1__init.sql 严格对齐（ddl-auto: validate）；TEXT 列显式 columnDefinition。
 */
@Entity
@Getter
@Setter
@Table(name = "teas")
public class Tea {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    private String category;

    @Column(length = 200)
    private String origin;

    @Column(name = "region_id")
    private Integer regionId;

    @Column(name = "process_id")
    private Integer processId;

    @Column(length = 50)
    private String season;

    @Column(length = 50)
    private String grade;

    @Column(length = 50)
    private String altitude;

    @Column(name = "best_temp")
    private Integer bestTemp;

    @Column(name = "best_time")
    private Integer bestTime;

    @Column(nullable = false)
    private Integer infusions = 3;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> flavor = new ArrayList<>();

    @Column(columnDefinition = "text")
    private String story;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "historical_period", length = 100)
    private String historicalPeriod;

    @Column(name = "water_requirement", length = 100)
    private String waterRequirement;

    @Column(name = "soup_color_min", length = 20)
    private String soupColorMin;

    @Column(name = "soup_color_max", length = 20)
    private String soupColorMax;

    @Column(name = "dry_tea_color", length = 20)
    private String dryTeaColor;

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
