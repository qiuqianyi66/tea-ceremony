package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** AiCircuitBreaker 状态机测试（P1-13）：CLOSED → 连续失败达阈值 OPEN → 时间窗后 HALF_OPEN 放行 → 成功恢复。 */
class AiCircuitBreakerTest {

    private AiCircuitBreaker breaker(int threshold, long openWindowMs) {
        return new AiCircuitBreaker(threshold, openWindowMs);
    }

    @Test
    void initialStateAllowsCall() {
        AiCircuitBreaker b = breaker(5, 30_000);
        assertThat(b.allowCall()).isTrue();
        assertThat(b.isOpen()).isFalse();
    }

    @Test
    void consecutiveFailuresOpenAfterThreshold() {
        AiCircuitBreaker b = breaker(5, 30_000);
        for (int i = 0; i < 4; i++) {
            b.onFailure();
            assertThat(b.allowCall()).isTrue();   // 未达阈值仍放行
        }
        b.onFailure();                            // 第 5 次失败 → OPEN
        assertThat(b.isOpen()).isTrue();
        assertThat(b.allowCall()).isFalse();
    }

    @Test
    void openWindowExpiryAllowsTrialThenSuccessRecovers() throws InterruptedException {
        AiCircuitBreaker b = breaker(2, 1000);    // 构造器下限钳 1000ms（防误配），用 1s 窗测试
        b.onFailure();
        b.onFailure();
        assertThat(b.allowCall()).isFalse();      // OPEN

        Thread.sleep(1100);                       // 超窗 → HALF_OPEN 放行试探
        assertThat(b.allowCall()).isTrue();
        b.onSuccess();                            // 试探成功 → 恢复 CLOSED
        assertThat(b.isOpen()).isFalse();
        assertThat(b.currentFailures()).isZero();
        assertThat(b.allowCall()).isTrue();
    }

    @Test
    void trialFailureReopensWindow() throws InterruptedException {
        AiCircuitBreaker b = breaker(2, 1000);
        b.onFailure();
        b.onFailure();
        assertThat(b.allowCall()).isFalse();

        Thread.sleep(1100);                       // 超窗放行
        b.onFailure();                            // 试探失败 → 重新 OPEN（计数继续累积）
        assertThat(b.isOpen()).isTrue();
        assertThat(b.allowCall()).isFalse();
    }

    @Test
    void successResetsFailureCountBeforeThreshold() {
        AiCircuitBreaker b = breaker(5, 30_000);
        b.onFailure();
        b.onFailure();
        b.onSuccess();
        assertThat(b.currentFailures()).isZero();
        assertThat(b.allowCall()).isTrue();
    }
}
