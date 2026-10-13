package com.tea.ai.service;

import com.tea.ai.repository.AiUsageLogRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * AI 计量消费端（P1-6）：每日统计调用/token，超预算日志告警。
 * 单用户免费自托管：无邮件/IM 通知渠道，日志告警即最小闭环；配置 ai.usage.daily-budget-tokens 调阈值。
 */
@Slf4j
@Service
public class AiUsageSummaryService {

    /** 每日 token 预算（默认 20 万，约等于按需用量告警线）。 */
    private final long dailyBudgetTokens;
    private final AiUsageLogRepository repository;

    public AiUsageSummaryService(AiUsageLogRepository repository,
                                 @Value("${ai.usage.daily-budget-tokens:200000}") long dailyBudgetTokens) {
        this.repository = repository;
        this.dailyBudgetTokens = dailyBudgetTokens;
    }

    /** 统计 from 以来的调用数与 token 量。 */
    public DailyUsage summarySince(LocalDateTime from) {
        long calls = repository.countSince(from);
        long tokensIn = repository.sumTokensInSince(from);
        long tokensOut = repository.sumTokensOutSince(from);
        return new DailyUsage(calls, tokensIn, tokensOut);
    }

    /** 是否超预算（纯函数，可测）。 */
    public boolean overBudget(long totalTokens) {
        return totalTokens > dailyBudgetTokens;
    }

    /** 每日 8 点统计昨日用量并告警（cron 可配置）。 */
    @Scheduled(cron = "${ai.usage.report-cron:0 0 8 * * *}")
    public void dailyReport() {
        LocalDateTime since = LocalDate.now().minusDays(1).atStartOfDay();
        DailyUsage usage = summarySince(since);
        long total = usage.tokensIn() + usage.tokensOut();
        log.info("AI usage yesterday: calls={} tokensIn={} tokensOut={} total={}",
                usage.calls(), usage.tokensIn(), usage.tokensOut(), total);
        if (overBudget(total)) {
            log.warn("AI budget exceeded: total {} > budget {}", total, dailyBudgetTokens);
        }
    }

    /** 用量汇总记录。 */
    public record DailyUsage(long calls, long tokensIn, long tokensOut) {
    }
}
