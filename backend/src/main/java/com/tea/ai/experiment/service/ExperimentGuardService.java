package com.tea.ai.experiment.service;

import com.tea.ai.experiment.dto.GuardrailConfig;
import com.tea.ai.experiment.dto.VariantMetrics;
import com.tea.ai.experiment.entity.AbExperiment;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 异常指标触发器：每 5 分钟评估 running 实验，命中 guardrail 即自动回滚（stop + 计数 + 告警日志）。
 *
 * 为什么是「停止」而不是「改回 control」：实验停止后 assign 一律返回 control，等于 100% 流量立刻回旧路径，
 * 且状态可审计（stopped_at / stop_reason）。不需要容器重启，这就是「毫秒级无损回滚」的实现方式。
 *
 * 评估窗口固定 60 分钟（与 ExperimentService 概览同窗口）：分钟级窗口在稀疏 AI 流量下永远样本不足，
 * 更长的窗口会让回滚滞后到事故结束之后。
 *
 * 判断逻辑全在 {@link #shouldRollback}（静态纯函数）：入参即全部输入，不读时钟不读库，可逐条断言。
 * 样本门槛是第一道闸——任一组不足 minSampleSize 就不判，避免 3 个请求的抖动把实验杀掉。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentGuardService {

    /** 回滚原因前缀：运维看 stop_reason 即可区分人工停止与自动回滚。 */
    static final String AUTO_ROLLBACK_PREFIX = "auto_rollback: ";
    /** 自动回滚计数（按实验打标签），用于看板与告警。 */
    public static final String AUTO_ROLLBACK_COUNTER = "tea.ab.auto_rollback";

    private final AbExperimentRepository repository;
    private final ExperimentService experimentService;
    private final MeterRegistry meterRegistry;

    /**
     * 评估入口：5 分钟一轮，首轮延迟 60 秒（让启动期的流量先落 trace，避免空窗口误判）。
     * 不用 fixedRate：单轮要跑「查实验 + 查指标 + 逐实验判断」，串行不重叠更省连接。
     */
    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    public void evaluateRunning() {
        List<AbExperiment> running = repository.findByStatus(AbExperiment.STATUS_RUNNING);
        if (running.isEmpty()) {
            return;
        }
        Map<String, Map<String, VariantMetrics>> stats = experimentService.variantStats();
        String singleRunningKey = running.size() == 1 ? running.get(0).getExpKey() : null;
        LocalDateTime now = LocalDateTime.now();
        for (AbExperiment experiment : running) {
            evaluate(experiment,
                    ExperimentService.variantsOf(experiment.getExpKey(), stats, singleRunningKey, running.size()),
                    now);
        }
    }

    private void evaluate(AbExperiment experiment, Map<String, VariantMetrics> variants, LocalDateTime now) {
        String expKey = experiment.getExpKey();
        VariantMetrics control = variants.getOrDefault(ExperimentService.CONTROL,
                VariantMetrics.empty(ExperimentService.CONTROL));
        VariantMetrics treatment = variants.getOrDefault(ExperimentService.TREATMENT,
                VariantMetrics.empty(ExperimentService.TREATMENT));
        long sampleSize = control.calls() + treatment.calls();

        // 样本不足也写回：last_evaluated_at 更新了才看得出「评估在跑，只是流量不够」
        experimentService.recordEvaluation(expKey, (int) Math.min(sampleSize, Integer.MAX_VALUE), now);

        Optional<String> reason = shouldRollback(control, treatment, experimentService.guardrailOf(experiment));
        if (reason.isEmpty()) {
            log.debug("A/B 实验未触发回滚：{}（样本 {}）", expKey, sampleSize);
            return;
        }
        experimentService.stop(expKey, AUTO_ROLLBACK_PREFIX + reason.get());
        meterRegistry.counter(AUTO_ROLLBACK_COUNTER, "exp", expKey).increment();
        log.warn("A/B 实验自动回滚：{}（样本 {}）：{}", expKey, sampleSize, reason.get());
    }

    /**
     * 是否应回滚；返回原因（空 = 不回滚，可含两条原因用 "; " 拼接）。
     *
     * 判定顺序与取舍：
     * 1. 任一组零样本或不足 minSampleSize → 不回滚（少样本的差值/比值全是噪声）；
     * 2. errorRate 任一为 null → 跳过该条。null 表示「没有分母」，把它当 0 会让 control=0% 时
     *    任何 1 次失败都被判成超标——这里宁可漏判也不误杀；
     * 3. p99：control 的 p99 为 null 或 <= 0 时无法算比值，跳过（同理不做 0 兜底）。
     */
    public static Optional<String> shouldRollback(VariantMetrics control, VariantMetrics treatment,
                                                  GuardrailConfig guardrail) {
        if (control == null || treatment == null || guardrail == null) {
            return Optional.empty();
        }
        if (control.calls() < guardrail.minSampleSize() || treatment.calls() < guardrail.minSampleSize()) {
            return Optional.empty();
        }
        List<String> reasons = new ArrayList<>();
        if (control.errorRate() != null && treatment.errorRate() != null) {
            double delta = treatment.errorRate() - control.errorRate();
            if (delta > guardrail.maxErrorRateDelta()) {
                reasons.add(String.format(Locale.ROOT, "error_rate delta %.3f > %.3f (control=%.3f, treatment=%.3f)",
                        delta, guardrail.maxErrorRateDelta(), control.errorRate(), treatment.errorRate()));
            }
        }
        if (control.p99() != null && treatment.p99() != null && control.p99() > 0) {
            double ratio = treatment.p99() / control.p99();
            if (ratio > guardrail.maxP99Ratio()) {
                reasons.add(String.format(Locale.ROOT, "p99 ratio %.2f > %.2f (control=%.1fms, treatment=%.1fms)",
                        ratio, guardrail.maxP99Ratio(), control.p99(), treatment.p99()));
            }
        }
        return reasons.isEmpty() ? Optional.empty() : Optional.of(String.join("; ", reasons));
    }
}
