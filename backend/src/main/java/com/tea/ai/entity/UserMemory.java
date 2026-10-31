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
 * 跨会话用户画像（user_memory 表，V12 迁移）。字段与 V12__user_memory.sql 严格对齐（ddl-auto: validate）。
 * 每用户每类一行：key ∈ {preference, restriction, habit}，value 为 LLM 合并后的一句话摘要。
 * 隐私红线（F-B2）：不存姓名/账号等敏感信息；用户可查看、可删除。
 */
@Entity
@Getter
@Setter
@Table(name = "user_memory")
public class UserMemory {

    /** 画像类别常量（与 ck_user_memory_key 约束一致）。 */
    public static final String KEY_PREFERENCE = "preference";
    public static final String KEY_RESTRICTION = "restriction";
    public static final String KEY_HABIT = "habit";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "key", nullable = false, length = 30)
    private String key;

    @Column(name = "value", nullable = false)
    private String value;

    @Column(name = "source_session_id")
    private Integer sourceSessionId;

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
