package com.tea.ai.entity;

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
 * 专家运行时领域技能（agent_skills 表，V6 迁移，ADR-017）。
 * 字段与 V6__agent_skills.sql 严格对齐（ddl-auto: validate）。
 * status: active；agent+domain 唯一（uk_agent_skills_agent_domain）。
 */
@Entity
@Getter
@Setter
@Table(name = "agent_skills")
public class AgentSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "agent", length = 50, nullable = false)
    private String agent;

    @Column(name = "domain", length = 50, nullable = false)
    private String domain;

    @Column(name = "skill", nullable = false)
    private String skill;

    @Column(name = "status", length = 20, nullable = false)
    private String status;

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
