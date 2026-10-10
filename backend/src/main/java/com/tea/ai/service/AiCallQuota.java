package com.tea.ai.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AI 会话调用配额（F-6，ADR-018）。
 *
 * <p><b>状态：为「登录 + sessionId」的调用方预留，当前无生效对象。</b>
 * 前端 teaAI.ts 走裸 fetch 匿名调用（不带 Authorization、不带 sessionId），
 * 命中 {@link #tryAcquire(Integer)} 的 {@code sessionId == null} 分支直接放行，
 * 故 {@code counts} 当前不会有任何 entry。前端已由 {@code RateLimitFilter} 按 IP 限流（10/min）覆盖。</p>
 *
 * <p>计数维度为 <b>sessionId</b>（非 userId）：换话题开新会话应重置配额，按 userId 计数会误伤。</p>
 *
 * <p>计数在内存中（进程重启即清零），与 RateLimitFilter（10/min 滑动窗口）是两层：
 * 限流管瞬时速率，配额管会话总量。</p>
 *
 * <p>内存增长边界：单用户自托管，会话总数有限（几十量级），每条仅一个 AtomicInteger；
 * 无清理机制属有意为之——不为「不会发生的泄漏」引入 Caffeine 依赖或定时任务。</p>
 */
@Component
public class AiCallQuota {

    private final int maxCalls;
    private final Map<Integer, AtomicInteger> counts = new ConcurrentHashMap<>();

    public AiCallQuota(@Value("${tea.ai.max-calls-per-session:10}") int maxCalls) {
        this.maxCalls = maxCalls;
    }

    /**
     * 尝试占用一次配额。
     *
     * @param sessionId 会话 ID；null（游客/匿名）直接放行不计数——当前前端即走此分支，配额不生效
     * @return true = 放行；false = 已达上限
     */
    public boolean tryAcquire(Integer sessionId) {
        if (sessionId == null) {
            return true; // 游客不计数
        }
        if (maxCalls <= 0) {
            return true; // <=0 视为不限（配置显式关闭）
        }
        int n = counts.computeIfAbsent(sessionId, k -> new AtomicInteger()).incrementAndGet();
        return n <= maxCalls;
    }

    /** 配置上限（0 或负数 = 不限）。 */
    public int maxCalls() {
        return maxCalls;
    }
}

