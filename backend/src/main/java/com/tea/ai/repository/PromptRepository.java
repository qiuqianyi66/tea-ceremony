package com.tea.ai.repository;

import com.tea.ai.entity.AgentPrompt;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 专家 prompt 版本 Repository。active 版本按更新时间取最新（灰度/回滚由 status 驱动）。
 */
public interface PromptRepository extends JpaRepository<AgentPrompt, Integer> {

    Optional<AgentPrompt> findFirstByAgentAndStatusOrderByUpdatedAtDesc(String agent, String status);
}
