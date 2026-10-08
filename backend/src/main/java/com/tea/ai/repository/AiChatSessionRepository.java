package com.tea.ai.repository;

import com.tea.ai.entity.AiChatSession;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI 会话头 Repository。归属校验走 findByIdAndUserId（防越权，AGENTS 防越权上线自查）。
 */
public interface AiChatSessionRepository extends JpaRepository<AiChatSession, Integer> {

    Optional<AiChatSession> findByIdAndUserId(Integer id, Integer userId);

    List<AiChatSession> findByUserIdOrderByUpdatedAtDesc(Integer userId);
}
