package com.tea.ai.resilience;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.ai.service.AiCircuitBreaker;
import org.junit.jupiter.api.Test;

/**
 * AiCircuitBreaker 分层熔断测试（改造后新增，不改既有 com.tea.ai.service.AiCircuitBreakerTest）。
 * 关键断言是「隔离」：一个 lane 熔断不能影响另一个 lane——改造前这正是全局单例的坑。
 */
class AiCircuitBreakerTest {

    private final AiCircuitBreaker breaker = new AiCircuitBreaker(5, 30_000);

    @Test
    void laneAOpenDoesNotAffectLaneB() {
        for (int i = 0; i < 5; i++) {
            breaker.onFailure("librarian");
        }

        assertThat(breaker.isOpen("librarian")).isTrue();
        assertThat(breaker.allowCall("librarian")).isFalse();
        assertThat(breaker.isOpen("chat")).isFalse();
        assertThat(breaker.allowCall("chat")).isTrue();
        assertThat(breaker.currentFailures("chat")).isZero();
    }

    @Test
    void successOnlyResetsItsOwnLane() {
        breaker.onFailure("taster");
        breaker.onFailure("brewer");
        breaker.onSuccess("taster");

        assertThat(breaker.currentFailures("taster")).isZero();
        assertThat(breaker.currentFailures("brewer")).isEqualTo(1);
    }

    @Test
    void blankAndNullLaneNormalizeToDefault() {
        breaker.onFailure(null);
        breaker.onFailure("");
        breaker.onFailure("   ");

        assertThat(breaker.currentFailures("default")).isEqualTo(3);
        assertThat(breaker.currentFailures(null)).isEqualTo(3);
    }

    @Test
    void laneKeysAreCaseInsensitive() {
        breaker.onFailure("Mentor");

        assertThat(breaker.currentFailures("mentor")).isEqualTo(1);
        assertThat(breaker.isOpen("MENTOR")).isFalse();
    }

    @Test
    void legacyNoArgApiStillBehavesLikeDefaultLane() {
        assertThat(breaker.allowCall()).isTrue();
        assertThat(breaker.isOpen()).isFalse();

        for (int i = 0; i < 4; i++) {
            breaker.onFailure();
            assertThat(breaker.allowCall()).isTrue();
        }
        breaker.onFailure();

        assertThat(breaker.isOpen()).isTrue();
        assertThat(breaker.allowCall()).isFalse();
        assertThat(breaker.currentFailures()).isEqualTo(5);
        // 旧 API 的桶就是 default：带上 lane 看也是同一个桶
        assertThat(breaker.isOpen(AiCircuitBreaker.DEFAULT_LANE)).isTrue();

        breaker.onSuccess();
        assertThat(breaker.isOpen()).isFalse();
        assertThat(breaker.currentFailures()).isZero();
    }

    @Test
    void bucketCountIsCappedAndOverflowFallsBackToDefault() {
        for (int i = 0; i < AiCircuitBreaker.MAX_BUCKETS; i++) {
            breaker.allowCall("lane" + i);
        }

        breaker.onFailure("lane-overflow");

        // 超界 lane 归入 default：既不会新建第 33 个桶，也不会丢失失败记录
        assertThat(breaker.currentFailures(AiCircuitBreaker.DEFAULT_LANE)).isEqualTo(1);
        assertThat(breaker.currentFailures("lane-overflow")).isEqualTo(1);
    }
}
