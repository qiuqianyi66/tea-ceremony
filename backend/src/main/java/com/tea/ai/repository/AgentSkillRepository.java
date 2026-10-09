package com.tea.ai.repository;

import com.tea.ai.entity.AgentSkill;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 运行时领域技能仓储（agent_skills；按 agent+domain+active 取最新）。
 */
public interface AgentSkillRepository extends JpaRepository<AgentSkill, Integer> {

    Optional<AgentSkill> findFirstByAgentAndDomainAndStatusOrderByUpdatedAtDesc(
            String agent, String domain, String status);
}
