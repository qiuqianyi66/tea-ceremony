package com.tea.ware.entity;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 茶器（teawares 表，V1 迁移 + V2 文化种子）。
 * 最小映射（T8 仅用于 ware_id 存在性校验），字段与 V1__init.sql 对齐（ddl-auto: validate）。
 */
@Entity
@Getter
@Setter
@Table(name = "teawares")
public class TeaWare {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "ware_type", length = 20)
    private String wareType;

    @Column(length = 100)
    private String material;

    private Integer capacity;

    @Column(length = 100)
    private String origin;

    @Column(length = 50)
    private String dynasty;

    @Column(length = 200)
    private String craft;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "culture_story", columnDefinition = "text")
    private String cultureStory;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> bonus = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Object> recommended = new ArrayList<>();

    @Column(nullable = false, length = 20)
    private String rarity = "common";

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
