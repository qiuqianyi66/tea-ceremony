package com.tea.ai.resilience;

import com.tea.common.exception.BadGatewayException;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * AI 调用深度门禁（防无限推理/专家互调递归）。
 * 语义：同一线程内每层 execute 进入 +1、退出 -1；深度超过 maxCallDepth 直接 502（前端按既有承重墙降级）。
 * 为什么用 ThreadLocal：深度是「当前这次请求的调用栈」属性，跨请求共享计数会互相污染；
 * 虚拟线程下每个请求本就有独立线程，ThreadLocal 天然按请求隔离。
 * 为什么必须 remove：Tomcat/虚拟线程池都会复用线程载体，残留计数会让下一个请求一进来就被判超限。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiCallDepthGuard {

    private static final String EXCEEDED_METRIC = "tea.ai.call.depth.exceeded";

    private final AiCallPolicy policy;
    private final MeterRegistry meterRegistry;

    /** 当前线程的调用深度；null = 无上下文（线程从未进入过 AI 调用）。 */
    private final ThreadLocal<Integer> depth = new ThreadLocal<>();

    /**
     * 进入一层调用。超限时抛 502 且不改动计数（外层 scope 仍需正常 exit）。
     * 返回值必须用 try-with-resources 关闭，否则深度泄漏。
     */
    public DepthScope enter() {
        int next = currentDepth() + 1;
        if (next > policy.maxCallDepth()) {
            meterRegistry.counter(EXCEEDED_METRIC).increment();
            log.warn("AI 调用深度超限：depth={} max={}（疑似无限推理或专家互调递归）",
                    next, policy.maxCallDepth());
            throw new BadGatewayException("AI 调用深度超限（疑似无限推理）");
        }
        depth.set(next);
        return new DepthScope();
    }

    /** 退出一层调用（仅由 DepthScope 调用）：归零即移除 ThreadLocal，防线程复用带到下一个请求。 */
    void exit() {
        int remaining = currentDepth() - 1;
        if (remaining <= 0) {
            depth.remove();
        } else {
            depth.set(remaining);
        }
    }

    /** 当前线程深度（0 = 未进入）。 */
    public int currentDepth() {
        Integer value = depth.get();
        return value == null ? 0 : value;
    }

    /** 当前线程是否仍挂着深度上下文（断言 ThreadLocal 已清理，防线程池残留）。 */
    boolean isTracking() {
        return depth.get() != null;
    }

    /** 一层调用的生命周期句柄：close 幂等，保证异常路径也只 exit 一次。 */
    public final class DepthScope implements AutoCloseable {

        private boolean closed;

        @Override
        public void close() {
            if (closed) {
                return;
            }
            closed = true;
            exit();
        }
    }
}
