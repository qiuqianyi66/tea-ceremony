package com.tea.ai.experiment.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;

/**
 * 实验配置视图（列表 / 详情 / 启停响应共用同一形状）。
 *
 * variants 以 JsonNode 原样透出：不同实验的变体参数结构不同（如 fallback 是布尔、agent 路由是字符串），
 * 在这里定死字段会逼每个新实验改 DTO。guardrail 相反——它有固定三键且参与判断，所以走 {@link GuardrailConfig} 强类型。
 */
public record ExperimentView(
        String expKey,
        String name,
        String description,
        String status,
        int trafficPercent,
        JsonNode variants,
        int sampleSize,
        LocalDateTime lastEvaluatedAt,
        LocalDateTime startedAt,
        LocalDateTime stoppedAt,
        String stopReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
