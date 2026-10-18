package com.tea.ai.quality;

import com.tea.tea.entity.Tea;
import com.tea.tea.repository.TeaRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 茶事实快照的加载与缓存（teas 表 → {@link TeaFacts}）。
 *
 * 为什么缓存 10 分钟而不是每次查询：定时任务每轮最多 20 条 trace，逐条查库是 20 次往返，
 * 而 teas 是低频变更的种子数据；10 分钟窗口保证「新加的茶最迟 10 分钟内可被认可」。
 *
 * 为什么加载失败返回空目录而不是抛异常：评分是旁路能力，茶表不可读（连接抖动/迁移中）
 * 时应该退化到「不判编造」，而不是让整批评分失败——失败留痕交给 log.warn。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TeaFactsProvider {

    static final long TTL_MILLIS = 600_000;

    private final TeaRepository teaRepository;

    private volatile Cache cache;

    public TeaFacts current() {
        Cache local = cache;
        if (local != null && System.currentTimeMillis() - local.loadedAt() < TTL_MILLIS) {
            return local.facts();
        }
        return reload();
    }

    /** 双检锁：并发评分批次只触发一次加载（@Scheduled fixedDelay 单线程，但接口与测试可并发调用）。 */
    private synchronized TeaFacts reload() {
        Cache local = cache;
        if (local != null && System.currentTimeMillis() - local.loadedAt() < TTL_MILLIS) {
            return local.facts();
        }
        List<Tea> teas;
        try {
            teas = teaRepository.findAll();
        } catch (RuntimeException e) {
            // 不缓存失败结果：下一轮会重试，避免一次抖动被放大成 10 分钟的盲区
            log.warn("加载茶数据失败，本轮有据性只按通用规则判: {}", e.getMessage());
            return TeaFacts.empty();
        }
        TeaFacts facts = toFacts(teas);
        cache = new Cache(facts, System.currentTimeMillis());
        return facts;
    }

    static TeaFacts toFacts(List<Tea> teas) {
        Set<String> names = new HashSet<>();
        Set<String> categories = new HashSet<>();
        Map<String, String> categoryByTea = new HashMap<>();
        Map<String, Integer> bestTempByTea = new HashMap<>();
        for (Tea tea : teas) {
            if (tea.getName() == null || tea.getName().isBlank()) {
                continue;
            }
            names.add(tea.getName());
            if (tea.getCategory() != null) {
                categories.add(tea.getCategory());
                categoryByTea.put(tea.getName(), tea.getCategory());
            }
            if (tea.getBestTemp() != null) {
                bestTempByTea.put(tea.getName(), tea.getBestTemp());
            }
        }
        return new TeaFacts(names, categories, categoryByTea, bestTempByTea);
    }

    private record Cache(TeaFacts facts, long loadedAt) {
    }
}
