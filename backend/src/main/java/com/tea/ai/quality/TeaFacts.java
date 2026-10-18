package com.tea.ai.quality;

import java.util.Map;
import java.util.Set;

/**
 * 规则评分需要的茶事实快照（来自 teas 表，只取判定要用的三样：茶名 / 茶类 / 最佳水温与茶类归属）。
 *
 * 为什么做成不可变快照而不是每次评分直接查库：一批 20 条 trace 会反复判同一批茶名，
 * 逐条查库是 20 次往返；快照刷新由 {@link TeaFactsProvider} 按 TTL 控制。
 */
public record TeaFacts(
        Set<String> teaNames,
        Set<String> categories,
        Map<String, String> categoryByTea,
        Map<String, Integer> bestTempByTea) {

    public TeaFacts {
        teaNames = teaNames == null ? Set.of() : Set.copyOf(teaNames);
        categories = categories == null ? Set.of() : Set.copyOf(categories);
        categoryByTea = categoryByTea == null ? Map.of() : Map.copyOf(categoryByTea);
        bestTempByTea = bestTempByTea == null ? Map.of() : Map.copyOf(bestTempByTea);
    }

    /** 茶数据不可用时的空目录：有据性只按通用规则判（不能因为查不到库就把所有茶名判成编造）。 */
    public static TeaFacts empty() {
        return new TeaFacts(Set.of(), Set.of(), Map.of(), Map.of());
    }

    public boolean isEmpty() {
        return teaNames.isEmpty();
    }
}
