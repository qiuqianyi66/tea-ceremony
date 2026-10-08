package com.tea.ai.service;

import com.tea.ai.entity.AgentPrompt;
import com.tea.ai.repository.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 专家 prompt 版本化（M5-S2，agent_prompts 表）。
 * 取 agent 的 active 版本；无 active 版本 → 回退内置常量（版本化前的行为不变，承重墙）。
 */
@Service
@RequiredArgsConstructor
public class PromptService {

    private static final String STATUS_ACTIVE = "active";

    private final PromptRepository promptRepository;

    @Transactional(readOnly = true)
    public String getPrompt(String agent, String fallback) {
        return promptRepository.findFirstByAgentAndStatusOrderByUpdatedAtDesc(agent, STATUS_ACTIVE)
                .map(AgentPrompt::getContent)
                .orElse(fallback);
    }
}
