package com.tea.ai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tea.ai.repository.AiUsageLogRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** AiUsageSummaryService 测试（P1-6 消费端）：聚合正确 / 预算判定 / 默认不超。 */
class AiUsageSummaryServiceTest {

    private final AiUsageLogRepository repo = mock(AiUsageLogRepository.class);

    private AiUsageSummaryService service(long budget) {
        return new AiUsageSummaryService(repo, budget);
    }

    @Test
    void summarySinceAggregatesCallsAndTokens() {
        when(repo.countSince(any(LocalDateTime.class))).thenReturn(5L);
        when(repo.sumTokensInSince(any(LocalDateTime.class))).thenReturn(1200L);
        when(repo.sumTokensOutSince(any(LocalDateTime.class))).thenReturn(800L);

        AiUsageSummaryService.DailyUsage usage = service(200000).summarySince(LocalDateTime.now());

        assertEquals(5, usage.calls());
        assertEquals(1200, usage.tokensIn());
        assertEquals(800, usage.tokensOut());
    }

    @Test
    void overBudgetTrueWhenTotalExceedsBudget() {
        AiUsageSummaryService svc = service(1000);
        assertTrue(svc.overBudget(1001));
        assertFalse(svc.overBudget(1000));
        assertFalse(svc.overBudget(999));
    }
}
