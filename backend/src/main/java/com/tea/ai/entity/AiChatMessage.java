package com.tea.ai.entity;

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
 * AI 会话消息（ai_messages 表，V3 迁移）。字段与 V3__agent_memory.sql 严格对齐（ddl-auto: validate）。
 * 随会话级联删除（DB FK ON DELETE CASCADE——用户删除控制权）；无 updated_at 列。
 */
@Entity
@Getter
@Setter
@Table(name = "ai_messages")
public class AiChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "session_id", nullable = false)
    private Integer sessionId;

    @Column(name = "role", length = 20, nullable = false)
    private String role;

    @Column(name = "content")
    private String content;

    @Column(name = "agent", length = 50)
    private String agent;

    @Column(name = "tokens")
    private Integer tokens;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
