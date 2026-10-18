package com.tea.ai.service;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AI 上游调用熔断器（P1-13，OPTIMIZATION_PLAN；2026-10-18 按 lane 分桶）。
 * - CLOSED：该 lane 连续失败 &lt; 阈值，正常放行。
 * - OPEN：该 lane 失败达阈值 → 快速失败（不再调 LLM），时间窗后放行一次试探。
 * - HALF_OPEN：试探成功 → 计数清零回 CLOSED；失败 → 重新 OPEN（计数继续累积，openedAt 刷新）。
 *
 * 为什么分桶：单桶版本让 5 个专家 + 透明代理共享一套计数，任一链路抖动都会把全部 AI 链路一起熔断，
 * 单点故障被放大成整站 AI 不可用。分桶后一个 lane 的故障只隔离该 lane。
 *
 * 线程安全：每桶 AtomicInteger 计数 + volatile 时间戳，无全局锁；桶表 ConcurrentHashMap。
 * 桶数量上界 MAX_BUCKETS：lane 是有限枚举（chat/librarian/advisor/taster/brewer/mentor），
 * 上界只为防误用（例如把用户 ID 当 lane）造成无界增长——超界统一归入 default 并告警。
 */
@Slf4j
@Component
public class AiCircuitBreaker {

    /** 缺省桶名：无参旧 API 与非法 lane 都落到这里。 */
    public static final String DEFAULT_LANE = "default";

    /** 桶表上界（已知链路仅 6 个，留足余量但不允许无界增长）。 */
    public static final int MAX_BUCKETS = 32;

    /** 连续失败阈值（配置 tea.circuit-breaker.failure-threshold，默认 5）。 */
    private final int failureThreshold;
    /** 熔断保持时长 ms（配置 tea.circuit-breaker.open-window-ms，默认 30s）。 */
    private final long openWindowMs;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public AiCircuitBreaker(
            @Value("${tea.circuit-breaker.failure-threshold:5}") int failureThreshold,
            @Value("${tea.circuit-breaker.open-window-ms:30000}") long openWindowMs) {
        this.failureThreshold = Math.max(1, failureThreshold);
        this.openWindowMs = Math.max(1000, openWindowMs);
    }

    /** 该 lane 是否放行本次调用：CLOSED 放行；OPEN 且未到时间窗 → 拒绝；OPEN 且超窗 → 放行（试探）。 */
    public boolean allowCall(String lane) {
        return bucket(lane).allowCall(openWindowMs);
    }

    /** 该 lane 调用成功：计数清零 + 关断（试探成功即恢复）。 */
    public void onSuccess(String lane) {
        bucket(lane).onSuccess();
    }

    /** 该 lane 调用失败：计数 +1，达阈值 → OPEN。 */
    public void onFailure(String lane) {
        bucket(lane).onFailure(failureThreshold);
    }

    /** 该 lane 是否处于 OPEN（测试运维观测）。 */
    public boolean isOpen(String lane) {
        return bucket(lane).isOpen();
    }

    /** 该 lane 当前连续失败次数（测试运维观测）。 */
    public int currentFailures(String lane) {
        return bucket(lane).failures();
    }

    /**
     * @deprecated 仅为兼容改造前的调用点与既有测试，语义等价于 lane = "default"。
     * 生产调用必须带 lane，否则又退回「全链路共享一个桶」的老问题。
     */
    @Deprecated
    public boolean allowCall() {
        return allowCall(DEFAULT_LANE);
    }

    /** @deprecated 仅为兼容，语义等价于 lane = "default"；生产调用必须带 lane。 */
    @Deprecated
    public void onSuccess() {
        onSuccess(DEFAULT_LANE);
    }

    /** @deprecated 仅为兼容，语义等价于 lane = "default"；生产调用必须带 lane。 */
    @Deprecated
    public void onFailure() {
        onFailure(DEFAULT_LANE);
    }

    /** @deprecated 仅为兼容，语义等价于 lane = "default"。 */
    @Deprecated
    public boolean isOpen() {
        return isOpen(DEFAULT_LANE);
    }

    /** @deprecated 仅为兼容，语义等价于 lane = "default"。 */
    @Deprecated
    public int currentFailures() {
        return currentFailures(DEFAULT_LANE);
    }

    /** 取桶（不存在则建）：null/空 lane 归一 default；超出上界归一 default 并告警。 */
    private Bucket bucket(String lane) {
        String key = normalize(lane);
        Bucket existing = buckets.get(key);
        if (existing != null) {
            return existing;
        }
        if (!DEFAULT_LANE.equals(key) && buckets.size() >= MAX_BUCKETS) {
            log.warn("AiCircuitBreaker 桶数已达上限 {}，lane={} 归一为 {}（lane 必须是已知链路名）",
                    MAX_BUCKETS, key, DEFAULT_LANE);
            key = DEFAULT_LANE;
        }
        return buckets.computeIfAbsent(key, k -> new Bucket());
    }

    private static String normalize(String lane) {
        if (lane == null || lane.isBlank()) {
            return DEFAULT_LANE;
        }
        return lane.trim().toLowerCase(Locale.ROOT);
    }

    /** 单 lane 状态：计数 + OPEN 起点时间戳。 */
    private static final class Bucket {

        private final AtomicInteger consecutiveFailures = new AtomicInteger();
        /** 0 = 未熔断（CLOSED）；&gt;0 = 进入 OPEN 的时间戳。 */
        private volatile long openedAt = 0;

        boolean allowCall(long openWindowMs) {
            long op = openedAt;
            if (op == 0) {
                return true;
            }
            return System.currentTimeMillis() - op >= openWindowMs;
        }

        void onSuccess() {
            consecutiveFailures.set(0);
            openedAt = 0;
        }

        void onFailure(int threshold) {
            if (consecutiveFailures.incrementAndGet() >= threshold) {
                openedAt = System.currentTimeMillis();
            }
        }

        int failures() {
            return consecutiveFailures.get();
        }

        boolean isOpen() {
            return openedAt != 0;
        }
    }
}
