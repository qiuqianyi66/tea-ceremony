package com.tea.ai.repository;

import com.tea.ai.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI 计量 Repository。
 */
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Integer> {
}
