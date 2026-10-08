package com.tea.ai.repository;

import com.tea.ai.entity.AiChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI 会话消息 Repository。最近 N 条用 id 倒序 + Pageable；顺序反转由 Service 负责（行为测试三规则）。
 */
public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Integer> {

    List<AiChatMessage> findBySessionIdOrderByIdDesc(Integer sessionId, Pageable pageable);
}
