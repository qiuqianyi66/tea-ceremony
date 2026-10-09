package com.tea.ai.agent;

/**
 * 请求复杂度档位（T09 复杂度路由；三档行为见 AgentOrchestrator.complexity）：
 * SIMPLE 直答 / MEDIUM 专家路由+RAG / COMPLEX 上下文压缩。
 */
public enum ComplexityLevel {
    SIMPLE,
    MEDIUM,
    COMPLEX
}
