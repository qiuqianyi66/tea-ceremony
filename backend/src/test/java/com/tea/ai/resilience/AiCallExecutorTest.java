package com.tea.ai.resilience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tea.ai.service.AiCircuitBreaker;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.QuotaExceededException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/**
 * AiCallExecutor 容错链路测试：成功 / 重试 / 耗尽 / 兜底 / 超时 / 业务错误不重试 / 熔断 / 深度 / 退避序列。
 * 全部不真等：Sleeper 注入记录型实现，超时用例才用真实短超时（200ms）。
 */
class AiCallExecutorTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final RecordingSleeper sleeper = new RecordingSleeper();

    /** 记录型 Sleeper：断言退避序列，且不让测试等待。 */
    private static final class RecordingSleeper implements Sleeper {

        private final List<Long> sleeps = new ArrayList<>();

        @Override
        public void sleep(long millis) {
            sleeps.add(millis);
        }
    }

    private static AiCallPolicy policy(long timeoutMs, int maxAttempts, long baseMs, double multiplier,
                                       double jitter, int maxDepth) {
        return new AiCallPolicy(timeoutMs, maxAttempts, baseMs, multiplier, jitter, maxDepth,
                List.of(408, 429, 500, 502, 503, 504));
    }

    private AiCallExecutor executor(AiCallPolicy policy) {
        return new AiCallExecutor(policy, new AiCallDepthGuard(policy, registry),
                new AiCircuitBreaker(5, 30_000), sleeper, registry);
    }

    private AiCallExecutor executor(AiCallPolicy policy, AiCircuitBreaker breaker) {
        return new AiCallExecutor(policy, new AiCallDepthGuard(policy, registry), breaker, sleeper, registry);
    }

    private double count(String lane, String outcome) {
        Counter counter = registry.find(AiCallExecutor.METRIC_ATTEMPTS)
                .tags("lane", lane, "outcome", outcome)
                .counter();
        return counter == null ? 0 : counter.count();
    }

    @Test
    void firstAttemptSuccessDoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3));

        String result = executor.execute("chat", () -> {
            calls.incrementAndGet();
            return "回答";
        }, null);

        assertThat(result).isEqualTo("回答");
        assertThat(calls).hasValue(1);
        assertThat(count("chat", AiCallExecutor.OUTCOME_SUCCESS)).isEqualTo(1.0);
        assertThat(sleeper.sleeps).isEmpty();
    }

    @Test
    void thirdAttemptSucceedsAfterTwoUpstreamFailures() {
        AtomicInteger calls = new AtomicInteger();
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3));

        String result = executor.execute("librarian", () -> {
            if (calls.incrementAndGet() < 3) {
                throw new BadGatewayException("上游 502");
            }
            return "第三次终于成功";
        }, null);

        assertThat(result).isEqualTo("第三次终于成功");
        assertThat(calls).hasValue(3);
        assertThat(count("librarian", AiCallExecutor.OUTCOME_UPSTREAM_ERROR)).isEqualTo(2.0);
        assertThat(count("librarian", AiCallExecutor.OUTCOME_SUCCESS)).isEqualTo(1.0);
    }

    @Test
    void allAttemptsFailWithoutFallbackThrowsBadGateway() {
        AtomicInteger calls = new AtomicInteger();
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3));

        assertThatThrownBy(() -> executor.execute("advisor", () -> {
            calls.incrementAndGet();
            throw new BadGatewayException("上游 502");
        }, null)).isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("上游 502");

        assertThat(calls).hasValue(3);
        assertThat(count("advisor", AiCallExecutor.OUTCOME_UPSTREAM_ERROR)).isEqualTo(3.0);
    }

    @Test
    void allAttemptsFailWithFallbackReturnsFallback() {
        AtomicInteger calls = new AtomicInteger();
        AiCallExecutor executor = executor(policy(20_000, 2, 0, 2.0, 0.0, 3));

        String result = executor.execute("taster", () -> {
            calls.incrementAndGet();
            throw new BadGatewayException("上游 502");
        }, () -> "兜底点评");

        assertThat(result).isEqualTo("兜底点评");
        assertThat(calls).hasValue(2);
    }

    @Test
    void fallbackReturningNullStillThrowsBadGateway() {
        AiCallExecutor executor = executor(policy(20_000, 1, 0, 2.0, 0.0, 3));

        assertThatThrownBy(() -> executor.execute("brewer", () -> {
            throw new BadGatewayException("上游 502");
        }, () -> null)).isInstanceOf(BadGatewayException.class);
    }

    @Test
    void hangUpstreamIsTimedOutAndRetried() {
        AiCallPolicy policy = policy(200, 2, 0, 2.0, 0.0, 3);
        AiCallExecutor executor = executor(policy);
        AtomicInteger calls = new AtomicInteger();
        long start = System.currentTimeMillis();

        assertThatThrownBy(() -> executor.execute("mentor", () -> {
            calls.incrementAndGet();
            Thread.sleep(500);
            return "迟到的回答";
        }, null)).isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("超时");

        long elapsed = System.currentTimeMillis() - start;
        assertThat(calls).hasValue(2);
        assertThat(count("mentor", AiCallExecutor.OUTCOME_TIMEOUT)).isEqualTo(2.0);
        // 硬超时必须真的截断：2 次 × 200ms，远小于上游 500ms×2 的自然耗时
        assertThat(elapsed).isLessThan(1_500);
    }

    @Test
    void quotaExceededIsNotRetriedAndBypassesFallback() {
        AtomicInteger calls = new AtomicInteger();
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3));

        assertThatThrownBy(() -> executor.execute("chat", () -> {
            calls.incrementAndGet();
            throw new QuotaExceededException("本轮对话已达上限");
        }, () -> {
            throw new AssertionError("业务错误不该被兜底掩盖");
        })).isInstanceOf(QuotaExceededException.class);

        assertThat(calls).hasValue(1);
        assertThat(sleeper.sleeps).isEmpty();
        assertThat(count("chat", AiCallExecutor.OUTCOME_BUSINESS_ERROR)).isEqualTo(1.0);
    }

    @Test
    void openCircuitSkipsUpstreamAndUsesFallback() {
        AiCircuitBreaker breaker = new AiCircuitBreaker(3, 30_000);
        for (int i = 0; i < 3; i++) {
            breaker.onFailure("chat");
        }
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3), breaker);
        AtomicInteger calls = new AtomicInteger();

        String result = executor.execute("chat", () -> {
            calls.incrementAndGet();
            return "不该调上游";
        }, () -> "熔断兜底");

        assertThat(result).isEqualTo("熔断兜底");
        assertThat(calls).hasValue(0);
        assertThat(count("chat", AiCallExecutor.OUTCOME_CIRCUIT_OPEN)).isEqualTo(1.0);
    }

    @Test
    void depthExceededSkipsUpstreamAndUsesFallback() {
        AiCallPolicy policy = policy(20_000, 3, 0, 2.0, 0.0, 1);
        AiCallDepthGuard guard = new AiCallDepthGuard(policy, registry);
        AiCallExecutor executor = new AiCallExecutor(policy, guard, new AiCircuitBreaker(5, 30_000), sleeper, registry);
        AtomicInteger upstream = new AtomicInteger();

        String result;
        try (AiCallDepthGuard.DepthScope occupied = guard.enter()) {
            // 当前已占满 maxCallDepth=1：执行器必须连门禁都不进，直接兜底
            result = executor.execute("chat", () -> {
                upstream.incrementAndGet();
                return "不该调上游";
            }, () -> "深度兜底");
        }

        assertThat(result).isEqualTo("深度兜底");
        assertThat(upstream).hasValue(0);
        assertThat(registry.counter("tea.ai.call.depth.exceeded").count()).isEqualTo(1.0);
        assertThat(count("chat", AiCallExecutor.OUTCOME_DEPTH_EXCEEDED)).isEqualTo(1.0);
    }

    @Test
    void backoffFollowsExponentialSequence() {
        AiCallExecutor executor = executor(policy(20_000, 3, 800, 2.0, 0.0, 3));

        assertThatThrownBy(() -> executor.execute("chat", () -> {
            throw new BadGatewayException("上游 502");
        }, null)).isInstanceOf(BadGatewayException.class);

        // 后退避由注入的 Sleeper 记录：base 800 × 2^(n-1)，jitter=0 时可精确断言
        assertThat(sleeper.sleeps).containsExactly(800L, 1_600L);
        assertThat(executor.backoffMillis(1)).isEqualTo(800);
    }

    @Test
    void unknownRuntimeExceptionIsWrappedOnceAndFallsBack() {
        AiCallExecutor executor = executor(policy(20_000, 3, 0, 2.0, 0.0, 3));
        AtomicInteger calls = new AtomicInteger();

        String result = executor.execute("chat", () -> {
            calls.incrementAndGet();
            throw new IllegalStateException("编码缺陷");
        }, () -> "兜底");

        assertThat(result).isEqualTo("兜底");
        // 未知异常不重试：重试只会把同一个缺陷放大三次
        assertThat(calls).hasValue(1);
        assertThat(count("chat", AiCallExecutor.OUTCOME_UPSTREAM_ERROR)).isEqualTo(1.0);
    }

    @Test
    void failureReportsToBreakerBucketOfItsOwnLane() {
        AiCircuitBreaker breaker = new AiCircuitBreaker(2, 30_000);
        AiCallExecutor executor = executor(policy(20_000, 2, 0, 2.0, 0.0, 3), breaker);

        assertThatThrownBy(() -> executor.execute("librarian", () -> {
            throw new BadGatewayException("上游 502");
        }, null)).isInstanceOf(BadGatewayException.class);

        assertThat(breaker.currentFailures("librarian")).isEqualTo(2);
        assertThat(breaker.isOpen("librarian")).isTrue();
        assertThat(breaker.isOpen("chat")).isFalse();
    }
}
