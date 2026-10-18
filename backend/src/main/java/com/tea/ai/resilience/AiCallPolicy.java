package com.tea.ai.resilience;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 调用容错策略（tea.ai.resilience.*，AiCallExecutor 的唯一参数源）。
 * 为什么配置化：超时、重试、退避是「按上游供应商调参」的运维参数——上游变慢时改 yml + 重启即可，
 * 不需要改代码重发版。
 * 为什么用 record + 构造绑定：策略在启动后不应被任何 bean 改值；可变 setter 会让排障时无法确认
 * 当时真正生效的数值（配置漂移典型来源）。
 * 非法值在紧凑构造器里归一为默认值而不是启动失败：一个写错的退避参数不应让整站起不来，
 * 但会被 AiCallPolicyTest 与日志口径固定住。
 */
@ConfigurationProperties(prefix = "tea.ai.resilience")
public record AiCallPolicy(
        /** 单次尝试硬超时（毫秒）：CompletableFuture.get 的等待上限，防上游挂起占住 Tomcat 线程。 */
        @DefaultValue("20000") long timeoutMs,
        /** 总尝试次数（含首次）。1 = 关闭重试。 */
        @DefaultValue("3") int maxAttempts,
        /** 首次退避基数（毫秒）。0 = 不退避（测试环境用）。 */
        @DefaultValue("800") long backoffBaseMs,
        /** 退避倍增系数：第 n 次失败后等待 base * multiplier^(n-1)。 */
        @DefaultValue("2.0") double backoffMultiplier,
        /** 退避抖动比例（0~1）：防同批请求在上一轮故障后同时重打（惊群）。 */
        @DefaultValue("0.2") double backoffJitterRatio,
        /** 允许的最大调用深度：防专家互调/推理链失控形成无限递归。 */
        @DefaultValue("3") int maxCallDepth) {

    private static final long DEFAULT_TIMEOUT_MS = 20_000;
    private static final int DEFAULT_MAX_ATTEMPTS = 3;
    private static final long DEFAULT_BACKOFF_BASE_MS = 800;
    private static final double DEFAULT_BACKOFF_MULTIPLIER = 2.0;
    private static final double DEFAULT_JITTER_RATIO = 0.2;
    private static final int DEFAULT_MAX_CALL_DEPTH = 3;

    public AiCallPolicy {
        timeoutMs = timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
        maxAttempts = maxAttempts > 0 ? maxAttempts : DEFAULT_MAX_ATTEMPTS;
        // 0 是合法值（不退避，测试用），只有负数视为误配
        backoffBaseMs = backoffBaseMs >= 0 ? backoffBaseMs : DEFAULT_BACKOFF_BASE_MS;
        backoffMultiplier = backoffMultiplier > 0 ? backoffMultiplier : DEFAULT_BACKOFF_MULTIPLIER;
        backoffJitterRatio = normalizeJitter(backoffJitterRatio);
        maxCallDepth = maxCallDepth > 0 ? maxCallDepth : DEFAULT_MAX_CALL_DEPTH;
    }

    /** 默认策略（等价于 yml 全缺省）：测试与兜底构造用，避免各处重复写字面量。 */
    public static AiCallPolicy defaults() {
        return new AiCallPolicy(DEFAULT_TIMEOUT_MS, DEFAULT_MAX_ATTEMPTS, DEFAULT_BACKOFF_BASE_MS,
                DEFAULT_BACKOFF_MULTIPLIER, DEFAULT_JITTER_RATIO, DEFAULT_MAX_CALL_DEPTH);
    }

    private static double normalizeJitter(double ratio) {
        if (ratio < 0) {
            return DEFAULT_JITTER_RATIO;
        }
        // >1 会让退避时间变成负数/翻倍失真，钳到 1（±100%）
        return Math.min(ratio, 1.0);
    }
}
