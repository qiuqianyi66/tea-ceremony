package com.tea.ai.service;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.entity.AiUsageLog;
import com.tea.ai.repository.AiUsageLogRepository;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;

/**
 * AI 用量计量（透明代理与专家共用；M5-S1 从 AiChatService 抽出避免重复）。
 * 计量失败不影响已成功的 LLM 响应（旁路观测，调用方自行 try/catch 或容忍）。
 */
@Component
@RequiredArgsConstructor
public class AiUsageLogger {

    private final AiUsageLogRepository usageLogRepository;
    private final MeterRegistry meterRegistry;

    public void save(Integer userId, AiChatRequest req, ChatResponse response, int latency) {
        AiUsageLog entry = new AiUsageLog();
        entry.setUserId(userId);
        entry.setAgent(req.agent() == null || req.agent().isBlank() ? "chat" : req.agent());
        entry.setModel(response.getMetadata().getModel());
        entry.setLatency(latency);
        Usage usage = response.getMetadata().getUsage();
        if (usage != null) {
            entry.setTokensIn(usage.getPromptTokens());
            entry.setTokensOut(usage.getCompletionTokens());
        }
        try {
            usageLogRepository.save(entry);
        } catch (Exception e) {
            // 落库失败计数后原样抛出：调用方（AiChatService/BaseExpertAgent）已有 try/catch 降级语义，行为不变
            meterRegistry.counter("tea.ai.usage.save.failed").increment();
            throw e;
        }
    }
}
