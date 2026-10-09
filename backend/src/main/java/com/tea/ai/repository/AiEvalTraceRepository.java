package com.tea.ai.repository;

import com.tea.ai.entity.AiEvalTrace;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * AI 评测 Trace 仓储（ai_eval_traces；append-only，无更新路径）。
 */
public interface AiEvalTraceRepository extends JpaRepository<AiEvalTrace, Long> {
}
