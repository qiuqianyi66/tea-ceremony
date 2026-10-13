package com.tea.ai.repository;

import com.tea.ai.entity.AiUsageLog;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * AI 计量 Repository。
 */
public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Integer> {

    /** 统计 from 以来的调用数（P1-6 消费端）。 */
    @Query("SELECT COUNT(l) FROM AiUsageLog l WHERE l.createdAt >= :from")
    long countSince(@Param("from") LocalDateTime from);

    /** 统计 from 以来的输入 token 总量（P1-6 消费端）。 */
    @Query("SELECT COALESCE(SUM(l.tokensIn), 0) FROM AiUsageLog l WHERE l.createdAt >= :from")
    long sumTokensInSince(@Param("from") LocalDateTime from);

    /** 统计 from 以来的输出 token 总量（P1-6 消费端）。 */
    @Query("SELECT COALESCE(SUM(l.tokensOut), 0) FROM AiUsageLog l WHERE l.createdAt >= :from")
    long sumTokensOutSince(@Param("from") LocalDateTime from);
}
