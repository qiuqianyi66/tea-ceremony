package com.tea.garden.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * 茶园能量事件账本（garden_energy_events 表，V4 迁移，append-only，ADR-015）。
 * 幂等键 user_id + client_id（uk_garden_energy_events_user_client，复用品鉴记录 client_id）；
 * collected_at NULL=未收、非空=已收集；金额不 UPDATE，防通胀可审计。
 * 字段与 V4__garden_energy.sql 严格对齐（ddl-auto: validate）。
 */
@Entity
@Getter
@Setter
@Table(name = "garden_energy_events")
public class GardenEnergyEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "client_id", nullable = false, length = 64)
    private String clientId;

    @Column(nullable = false)
    private Integer amount;

    @Column(nullable = false, length = 30)
    private String source;

    @Column(name = "collected_at")
    private LocalDateTime collectedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
