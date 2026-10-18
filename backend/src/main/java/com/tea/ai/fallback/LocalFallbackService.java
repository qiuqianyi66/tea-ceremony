package com.tea.ai.fallback;

import com.tea.ai.fallback.AiLocalRuleEngine.TeaFact;
import com.tea.ai.fallback.AiLocalRuleEngine.TeawareFact;
import com.tea.tea.repository.TeaRepository;
import com.tea.ware.repository.TeaWareRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 本地规则库兜底服务（AI 核心服务不可用时的答复入口）。
 *
 * 职责边界：只做「取数 + 打点 + 不抛异常」三件事，规则判定全部在 {@link AiLocalRuleEngine}（纯函数）。
 * 拆两层的原因：规则可脱离 Spring 单测，兜底路径也不会因为容器/事务问题整体失效。
 *
 * 不抛异常是硬约束：兜底是最后一道答复能力，它失败只能表现为「没兜住」（返回 empty），
 * 绝不能升级成 5xx——否则调用方本已降级的请求会再被打断一次。
 */
@Slf4j
@Service
public class LocalFallbackService {

    /** 命中打点：rule 标签见 AiLocalRuleEngine.RULE_*。 */
    static final String METRIC_HIT = "tea.ai.fallback.hit";

    /** 茶数据快照有效期：茶参数几乎不变，但规则库不该长期拿着启动时的旧数据（新建的茶要能查到）。 */
    static final long SNAPSHOT_TTL_NANOS = 5L * 60 * 1_000_000_000;

    private final TeaRepository teaRepository;
    private final TeaWareRepository teaWareRepository;
    private final MeterRegistry meterRegistry;

    /** 快照缓存：每次问答都读两张表没有必要，但也不能永久缓存（TTL 见上）。 */
    private volatile Snapshot snapshot;

    public LocalFallbackService(TeaRepository teaRepository,
                                TeaWareRepository teaWareRepository,
                                MeterRegistry meterRegistry) {
        this.teaRepository = teaRepository;
        this.teaWareRepository = teaWareRepository;
        this.meterRegistry = meterRegistry;
    }

    /**
     * 按问题取兜底答复；未命中返回 empty。
     * 任何异常（数据库不可用、数据脏、打点失败）都吞掉并返回 empty——兜底本身绝不抛。
     */
    public Optional<String> answerFor(String question) {
        // 空问句必然不命中：先返回，避免为了一个空答案去读表（兜底路径在高频失败时会被反复调用）
        if (question == null || question.isBlank()) {
            return Optional.empty();
        }
        try {
            Optional<AiLocalRuleEngine.Hit> hit = engine().match(question);
            if (hit.isEmpty()) {
                return Optional.empty();
            }
            meterRegistry.counter(METRIC_HIT, "rule", hit.get().rule()).increment();
            return Optional.of(hit.get().answer());
        } catch (Exception e) {
            // 只记 warn：兜底失败在业务上等价于「未命中」，不是系统错误，没有栈的必要
            log.warn("ai local fallback unavailable: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** 取当前快照对应的规则引擎（过期则重建；重建失败时沿用旧快照）。 */
    AiLocalRuleEngine engine() {
        Snapshot current = snapshot;
        if (current != null && System.nanoTime() - current.loadedAtNanos() < SNAPSHOT_TTL_NANOS) {
            return current.engine();
        }
        try {
            AiLocalRuleEngine fresh = buildEngine();
            snapshot = new Snapshot(fresh, System.nanoTime());
            return fresh;
        } catch (RuntimeException e) {
            if (current != null) {
                // 刷新失败（例如数据库抖动）不该把已有数据一起丢掉：答旧数据也好过完全没有兜底
                log.warn("ai fallback snapshot refresh failed, keep stale: {}", e.getMessage());
                return current.engine();
            }
            throw e;
        }
    }

    /** 从数据库取数并装配规则引擎（茶名/参数/器具全部来自表，引擎侧零硬编码）。 */
    private AiLocalRuleEngine buildEngine() {
        List<TeaFact> teas = teaRepository.findAll().stream()
                .map(tea -> new TeaFact(tea.getName(), tea.getCategory(), tea.getBestTemp(),
                        tea.getBestTime(), tea.getInfusions(), tea.getOrigin(), tea.getDescription()))
                .toList();
        List<TeawareFact> teawares = teaWareRepository.findAll().stream()
                .map(ware -> new TeawareFact(ware.getName(), ware.getWareType(), ware.getMaterial(),
                        ware.getCapacity(), ware.getDescription(), categoriesOf(ware.getRecommended())))
                .toList();
        return new AiLocalRuleEngine(teas, teawares);
    }

    /** teawares.recommended 是 JSONB 数组（元素为茶类名），转成字符串列表供按茶类反查。 */
    private static List<String> categoriesOf(List<Object> recommended) {
        if (recommended == null) {
            return List.of();
        }
        return recommended.stream()
                .filter(java.util.Objects::nonNull)
                .map(String::valueOf)
                .toList();
    }

    /** 快照：引擎实例 + 载入时刻（单调时钟，避免系统时间调整导致 TTL 判定错乱）。 */
    private record Snapshot(AiLocalRuleEngine engine, long loadedAtNanos) {
    }
}
