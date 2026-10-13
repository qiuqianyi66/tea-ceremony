package com.tea.ai.service;

import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AI 上游调用熔断器（P1-13，OPTIMIZATION_PLAN）。
 * - CLOSED：连续失败 &lt; 阈值，正常放行。
 * - OPEN：连续失败达阈值 → 快速失败（不再调 LLM），时间窗后转 HALF_OPEN 放行一次试探。
 * - HALF_OPEN：试探成功 → 计数清零回 CLOSED；失败 → 重新 OPEN（计数继续累积，openedAt 刷新）。
 * 语义：OPEN 时 AiChatService 直接抛 BadGatewayException（502），前端 teaAI.ts 走既有规则降级——不改变承重墙。
 * 线程安全：AtomicInteger 计数 + volatile 时间戳，单实例无锁。
 */
@Component
public class AiCircuitBreaker {

    /** 连续失败阈值（配置 tea.circuit-breaker.failure-threshold，默认 5）。 */
    private final int failureThreshold;
    /** 熔断保持时长 ms（配置 tea.circuit-breaker.open-window-ms，默认 30s）。 */
    private final long openWindowMs;

    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    /** 0 = 未熔断（CLOSED）；>0 = 进入 OPEN 的时间戳。 */
    private volatile long openedAt = 0;

    public AiCircuitBreaker(
            @Value("${tea.circuit-breaker.failure-threshold:5}") int failureThreshold,
            @Value("${tea.circuit-breaker.open-window-ms:30000}") long openWindowMs) {
        this.failureThreshold = Math.max(1, failureThreshold);
        this.openWindowMs = Math.max(1000, openWindowMs);
    }

    /** 是否放行本次 LLM 调用：CLOSED 放行；OPEN 且未到时间窗 → 拒绝；OPEN 且超窗 → 放行（HALF_OPEN 试探）。 */
    public boolean allowCall() {
        long op = openedAt;
        if (op == 0) {
            return true;
        }
        return System.currentTimeMillis() - op >= openWindowMs;
    }

    /** 调用成功：计数清零 + 关断（HALF_OPEN 试探成功即恢复）。 */
    public void onSuccess() {
        consecutiveFailures.set(0);
        openedAt = 0;
    }

    /** 调用失败：计数 +1，达阈值 → OPEN（记录时间戳）。 */
    public void onFailure() {
        if (consecutiveFailures.incrementAndGet() >= failureThreshold) {
            openedAt = System.currentTimeMillis();
        }
    }

    /** 当前连续失败次数（测试观测）。 */
    public int currentFailures() {
        return consecutiveFailures.get();
    }

    /** 是否处于 OPEN 状态（测试观测）。 */
    public boolean isOpen() {
        return openedAt != 0;
    }
}
