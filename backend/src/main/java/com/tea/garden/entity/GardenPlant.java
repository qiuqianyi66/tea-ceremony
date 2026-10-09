package com.tea.garden.entity;

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

/**
 * 茶园植物（garden_plants 表，V1 建表 + V4 扩展）。
 * 幂等键 user_id + client_id（uk_garden_plants_user_client）；status 语义化阶段（ADR-015），
 * energy 为已收集能量累计，阶段推进只升不降。字段与 V1/V4 迁移严格对齐（ddl-auto: validate）。
 */
@Entity
@Getter
@Setter
@Table(name = "garden_plants")
public class GardenPlant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "client_id", nullable = false, length = 64)
    private String clientId;

    @Column(name = "plant_type", length = 50)
    private String plantType;

    @Column(nullable = false, length = 20)
    private String status = "planted";

    @Column(nullable = false)
    private Integer energy = 0;

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
