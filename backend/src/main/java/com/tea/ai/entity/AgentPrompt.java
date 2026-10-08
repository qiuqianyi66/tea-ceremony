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
 * 专家 prompt 版本（agent_prompts 表，V1 迁移）。字段与 V1__init.sql 严格对齐（ddl-auto: validate）。
 * status: draft/active（灰度/回滚）；agent+version 唯一（uk_agent_prompts_agent_version）。
 */
@Entity
@Getter
@Setter
@Table(name = "agent_prompts")
public class AgentPrompt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "agent", length = 50, nullable = false)
    private String agent;

    @Column(name = "version", length = 20, nullable = false)
    private String version;

    @Column(name = "content", nullable = false)
    private String content;

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
