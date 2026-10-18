package com.tea.ai.resilience;

import com.tea.ai.service.AiCircuitBreaker;
import com.tea.common.exception.BadGatewayException;
import com.tea.common.exception.BusinessException;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * AI 调用容错执行器：深度门禁 → 熔断门禁 → 硬超时 + 重试 → 兜底。
 * 为什么统一收口：改造前 BaseExpertAgent.callLlm 与 AiChatService.transparentChat 各写一份
 * 「一次 try/catch 抛 502」，超时/重试/隔离无法在同一处演进；把链路固定在执行器里，
 * 新增专家只传 lane，不再复制容错代码。
 *
 * lane 是隔离键（chat / librarian / advisor / taster / brewer / mentor）：熔断按 lane 分桶，
 * 单个专家上游抖动不再连带熔断其它链路。
 *
 * 异常口径（唯一出口）：
 * - 可重试：TimeoutException / BadGatewayException（上游不可用）
 * - 不可重试、原样上抛：QuotaExceeded / Unauthorized / BadRequest / NotFound（业务错误重试无意义）
 * - 其它异常：不重试（可能是代码缺陷，重试只会放大），包装 502 并先走兜底
 * - 所有失败分支只抛 BadGatewayException 或上述业务异常，原始上游堆栈不进响应
 */
@Slf4j
@Component
public class AiCallExecutor {

    static final String METRIC_ATTEMPTS = "tea.ai.call.attempts";

    static final String OUTCOME_SUCCESS = "success";
    static final String OUTCOME_TIMEOUT = "timeout";
    static final String OUTCOME_UPSTREAM_ERROR = "upstream_error";
    static final String OUTCOME_CIRCUIT_OPEN = "circuit_open";
    static final String OUTCOME_DEPTH_EXCEEDED = "depth_exceeded";
    static final String OUTCOME_BUSINESS_ERROR = "business_error";

    private final AiCallPolicy policy;
    private final AiCallDepthGuard depthGuard;
    private final AiCircuitBreaker circuitBreaker;
    private final Sleeper sleeper;
    private final MeterRegistry meterRegistry;

    /**
     * 虚拟线程池（Java 21）：单次尝试独占一个虚拟线程，超时后 cancel(true) 中断，
     * 不占用平台线程；池不可用 try-with-resources 通过期关闭——close() 会等待残留任务结束，
     * 那样超时就退化成「等上游自己结束」，硬超时失效。
     */
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public AiCallExecutor(AiCallPolicy policy,
                          AiCallDepthGuard depthGuard,
                          AiCircuitBreaker circuitBreaker,
                          Sleeper sleeper,
                          MeterRegistry meterRegistry) {
        this.policy = policy;
        this.depthGuard = depthGuard;
        this.circuitBreaker = circuitBreaker;
        this.sleeper = sleeper;
        this.meterRegistry = meterRegistry;
    }

    /**
     * 执行一次带容错的 AI 调用。
     *
     * @param lane     隔离键（熔断桶 + 指标标签），null/空归一为 default
     * @param op       真实上游调用
     * @param fallback 兜底（可为 null）：全部失败 / 熔断 / 深度超限时调用；
     *                 null 或返回 null → 抛 BadGatewayException
     */
    public <T> T execute(String lane, AiOperation<T> op, Supplier<T> fallback) {
        String key = normalizeLane(lane);
        AiCallDepthGuard.DepthScope scope;
        try {
            scope = depthGuard.enter();
        } catch (BadGatewayException e) {
            // 深度超限：连门禁都没进，绝不再调上游；直接兜底
            count(key, OUTCOME_DEPTH_EXCEEDED);
            return fallbackOrThrow(key, e, fallback);
        }
        // 深度计数必须在所有路径上归还（含业务异常直接上抛、线程中断）
        try (scope) {
            return withCircuitGate(key, op, fallback);
        }
    }

    private <T> T withCircuitGate(String lane, AiOperation<T> op, Supplier<T> fallback) {
        if (!circuitBreaker.allowCall(lane)) {
            count(lane, OUTCOME_CIRCUIT_OPEN);
            log.warn("AI 调用被熔断拦截 lane={}（窗口内不调上游，直接兜底）", lane);
            return fallbackOrThrow(lane, new BadGatewayException("AI 服务暂时不可用（熔断保护中）"), fallback);
        }
        int maxAttempts = Math.max(1, policy.maxAttempts());
        RuntimeException lastFailure = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                T value = callWithTimeout(op);
                circuitBreaker.onSuccess(lane);
                count(lane, OUTCOME_SUCCESS);
                return value;
            } catch (TimeoutException e) {
                lastFailure = new BadGatewayException("AI 服务调用超时（" + policy.timeoutMs() + "ms）");
                reportFailure(lane, OUTCOME_TIMEOUT);
                log.warn("AI 调用超时 lane={} attempt={}/{} timeoutMs={}",
                        lane, attempt, maxAttempts, policy.timeoutMs());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                reportFailure(lane, OUTCOME_UPSTREAM_ERROR);
                log.warn("AI 调用被中断 lane={} attempt={}/{}", lane, attempt, maxAttempts);
                return fallbackOrThrow(lane, new BadGatewayException("AI 服务调用被中断"), fallback);
            } catch (BadGatewayException e) {
                lastFailure = e;
                reportFailure(lane, OUTCOME_UPSTREAM_ERROR);
                log.warn("AI 调用上游失败 lane={} attempt={}/{}: {}", lane, attempt, maxAttempts, e.getMessage());
            } catch (BusinessException e) {
                // 配额/鉴权/参数/资源不存在：请求本身有问题，重试不会变好，也不该被兜底掩盖
                reportBusinessError(lane);
                log.warn("AI 调用业务错误 lane={} type={}: {}",
                        lane, e.getClass().getSimpleName(), e.getMessage());
                throw e;
            } catch (Exception e) {
                // 未知异常（含非 502 运行时错误）：可能是代码缺陷，重试只会放大 → 不重试，先兜底
                reportFailure(lane, OUTCOME_UPSTREAM_ERROR);
                log.warn("AI 调用异常 lane={} attempt={}/{} type={}: {}",
                        lane, attempt, maxAttempts, e.getClass().getSimpleName(), e.getMessage());
                return fallbackOrThrow(lane, new BadGatewayException("AI 服务调用失败"), fallback);
            }
            if (attempt < maxAttempts && !sleepBackoff(lane, attempt)) {
                return fallbackOrThrow(lane, new BadGatewayException("AI 服务调用被中断"), fallback);
            }
        }
        log.warn("AI 调用重试耗尽 lane={} attempts={}", lane, maxAttempts);
        return fallbackOrThrow(lane, lastFailure, fallback);
    }

    /** 单次尝试：虚拟线程 + Future.get 硬超时；超时即取消并中断上游任务。 */
    private <T> T callWithTimeout(AiOperation<T> op) throws Exception {
        Future<T> future = executor.submit(op::run);
        try {
            return future.get(policy.timeoutMs(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            // 不取消的话，挂起的上游连接会一直跑到它自己结束
            future.cancel(true);
            throw e;
        } catch (InterruptedException e) {
            future.cancel(true);
            throw e;
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof Exception ex) {
                throw ex;
            }
            if (cause instanceof Error err) {
                throw err;
            }
            throw new IllegalStateException(cause);
        }
    }

    /** 第 n 次失败后的退避时长：base * multiplier^(n-1) * (1 ± jitter)。 */
    long backoffMillis(int failedAttempt) {
        double base = policy.backoffBaseMs() * Math.pow(policy.backoffMultiplier(), failedAttempt - 1);
        double ratio = policy.backoffJitterRatio();
        double jitter = ratio <= 0 ? 0 : ThreadLocalRandom.current().nextDouble(-ratio, ratio);
        return Math.max(0, Math.round(base * (1 + jitter)));
    }

    /** 退避；被中断返回 false（调用方立即收敛，不再重试）。 */
    private boolean sleepBackoff(String lane, int failedAttempt) {
        long millis = backoffMillis(failedAttempt);
        if (millis <= 0) {
            return true;
        }
        try {
            sleeper.sleep(millis);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("AI 重试退避被中断 lane={} attempt={} backoffMs={}", lane, failedAttempt, millis);
            return false;
        }
    }

    /**
     * 兜底出口：fallback 为 null 或返回 null → 抛原始 502。
     * 兜底本身抛异常时不吞：那是调用方代码缺陷，包成 502 会把根因藏起来。
     */
    private <T> T fallbackOrThrow(String lane, RuntimeException failure, Supplier<T> fallback) {
        if (fallback == null) {
            throw failure;
        }
        T value = fallback.get();
        if (value == null) {
            throw failure;
        }
        // 兜底不是静默降级：必须留痕，否则上游腐烂会被兜底数据掩盖
        log.warn("AI 调用走兜底 lane={} cause={}", lane, failure.getMessage());
        return value;
    }

    private void reportFailure(String lane, String outcome) {
        circuitBreaker.onFailure(lane);
        count(lane, outcome);
    }

    /**
     * 业务错误只计数，<b>不计入熔断</b>。
     *
     * <p>为什么必须分开：熔断器的语义是「下游坏了，别再打」，判据是上游健康状况。
     * 业务错误（配额超限、鉴权失败、参数非法）恰恰说明**上游是好的**——它正确拒绝了一个坏请求。
     * 把这类错误计进熔断，等于让一个反复触发配额的客户端替所有人把 lane 打挂：
     * 一个用户刷爆配额 → 整条链路进入 OPEN → 其他用户全部拿到兜底或 502。
     * 这正是熔断器被滥用时最典型的反向失效。</p>
     */
    private void reportBusinessError(String lane) {
        count(lane, OUTCOME_BUSINESS_ERROR);
    }

    private void count(String lane, String outcome) {
        meterRegistry.counter(METRIC_ATTEMPTS, "lane", lane, "outcome", outcome).increment();
    }

    /** lane 归一（与 AiCircuitBreaker 同规则）：null/空 → default，避免桶键大小写分裂。 */
    private static String normalizeLane(String lane) {
        if (lane == null || lane.isBlank()) {
            return AiCircuitBreaker.DEFAULT_LANE;
        }
        return lane.trim().toLowerCase(Locale.ROOT);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
