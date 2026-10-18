package com.tea.ai.resilience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tea.common.exception.BadGatewayException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;

/** AiCallDepthGuard：深度计数、超限 502、异常路径必 exit、ThreadLocal 不泄漏。 */
class AiCallDepthGuardTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

    private AiCallDepthGuard guard(int maxDepth) {
        AiCallPolicy policy = new AiCallPolicy(20_000, 3, 800, 2.0, 0.2, maxDepth, List.of(500));
        return new AiCallDepthGuard(policy, registry);
    }

    @Test
    void enterIncrementsAndCloseRemovesContext() {
        AiCallDepthGuard guard = guard(3);
        try (AiCallDepthGuard.DepthScope scope = guard.enter()) {
            assertThat(scope).isNotNull();
            assertThat(guard.currentDepth()).isEqualTo(1);
            assertThat(guard.isTracking()).isTrue();
        }

        assertThat(guard.currentDepth()).isZero();
        assertThat(guard.isTracking()).isFalse();
    }

    @Test
    void nestedScopesUnwindOneLevelAtATime() {
        AiCallDepthGuard guard = guard(3);
        try (AiCallDepthGuard.DepthScope outer = guard.enter()) {
            try (AiCallDepthGuard.DepthScope middle = guard.enter()) {
                assertThat(guard.currentDepth()).isEqualTo(2);
            }
            assertThat(guard.currentDepth()).isEqualTo(1);
        }
        assertThat(guard.isTracking()).isFalse();
    }

    @Test
    void exceedingMaxDepthThrowsBadGatewayAndCounts() {
        AiCallDepthGuard guard = guard(1);
        try (AiCallDepthGuard.DepthScope scope = guard.enter()) {
            assertThatThrownBy(guard::enter)
                    .isInstanceOf(BadGatewayException.class)
                    .hasMessageContaining("深度超限");
            // 超限被拒后，外层深度必须保持不变（否则外层 close 会少减一层）
            assertThat(guard.currentDepth()).isEqualTo(1);
        }
        assertThat(guard.isTracking()).isFalse();
        assertThat(registry.counter("tea.ai.call.depth.exceeded").count()).isEqualTo(1.0);
    }

    @Test
    void scopeClosesEvenWhenBodyThrows() {
        AiCallDepthGuard guard = guard(2);
        try (AiCallDepthGuard.DepthScope scope = guard.enter()) {
            throw new IllegalStateException("业务异常");
        } catch (IllegalStateException expected) {
            assertThat(expected.getMessage()).isEqualTo("业务异常");
        }

        assertThat(guard.currentDepth()).isZero();
        assertThat(guard.isTracking()).isFalse();
    }

    @Test
    void closeIsIdempotent() {
        AiCallDepthGuard guard = guard(2);
        AiCallDepthGuard.DepthScope scope = guard.enter();
        scope.close();
        scope.close();

        assertThat(guard.currentDepth()).isZero();
        assertThat(guard.isTracking()).isFalse();
    }

    @Test
    void depthIsIsolatedPerThread() throws Exception {
        AiCallDepthGuard guard = guard(3);
        try (AiCallDepthGuard.DepthScope scope = guard.enter()) {
            int[] otherThreadDepth = {-1};
            Thread virtual = Thread.ofVirtual().start(() -> otherThreadDepth[0] = guard.currentDepth());
            virtual.join();
            // 另一个线程（虚拟线程）不应看到本线程的深度：深度是「这次请求调用栈」的属性
            assertThat(otherThreadDepth[0]).isZero();
        }
        assertThat(guard.currentDepth()).isZero();
    }
}
