package com.tea.ai.fallback;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 本地规则库兜底引擎（核心服务不可用时的最后一道答复能力）。
 *
 * 为什么存在：后端此前 AI 失败只有 502 一条路，兜底全压在前端 src/services/teaAI.ts；
 * 一旦调用方不是浏览器（外部 agent、离线批处理、无前端场景），就完全没有答复能力。
 *
 * 与前端 ruleBasedReply 的关系：只对齐「能力边界」——茶名 → 茶类 → 器具三条检索线；
 * 实现独立（后端不引用前端源码，避免跨端依赖不可编译）。
 *
 * 数据来源硬约束：本类不含任何茶名常量，也不含按茶类写死的参数。
 * 茶名 / 水温 / 时间 / 泡数 / 器具全部由构造入参提供；各茶类基准区间由入参按 category
 * 就地聚合（min/max），库内数据一变，答复口径自动跟随。
 *
 * 纯函数：无 Spring 依赖、无 IO、无时钟、无静态可变状态，可直接 new（测试与兜底路径都不需要容器）。
 */
public final class AiLocalRuleEngine {

    /** 茶事实（由 Service 从 teas 表映射；引擎不依赖 JPA 实体，兜底路径不被持久化上下文牵住）。 */
    public record TeaFact(String name, String category, Integer bestTemp, Integer bestTime,
                          Integer infusions, String origin, String description) {
    }

    /** 茶器事实（teawares 表）：recommendedCategories 是「适合茶类」，用于按茶类反查器具。 */
    public record TeawareFact(String name, String wareType, String material, Integer capacity,
                              String description, List<String> recommendedCategories) {
    }

    /** 命中结果：rule 供打点标签（tea.ai.fallback.hit{rule}），answer 直接回给调用方。 */
    public record Hit(String rule, String answer) {
    }

    /** 规则标签（打点用，取值稳定，不随文案调整而变化）。 */
    public static final String RULE_WATER_TEMP = "water_temp";
    public static final String RULE_STEEP_TIME = "steep_time";
    public static final String RULE_VESSEL = "vessel";
    public static final String RULE_TEA_INTRO = "tea_intro";
    public static final String RULE_CATEGORY_INTRO = "category_intro";

    /** 超长输入直接不命中：兜底答复是短问答能力，问句过长说明不是规则库的适用场景。 */
    private static final int MAX_QUESTION_CHARS = 500;
    /** 答复上限：与前端 80 字量级对齐，兜底文本保持可读短句。 */
    private static final int MAX_ANSWER_CHARS = 220;
    /** 描述摘要长度：只用库内原文前 N 字，不做改写（不编造）。 */
    private static final int PREVIEW_CHARS = 48;

    /**
     * 通行茶水比 1:50（1g 茶配 50ml 水）。
     * 库内 teawares 只有容量、teas 没有投茶量字段，投茶建议只能由容量换算；
     * 这是器具无关的茶艺通行基准（不随茶类/茶名变化），集中成常量便于审计。
     */
    private static final int ML_PER_GRAM = 50;

    /** 口语分类别名 → 库内 category 值。别名是分类词汇不是茶名；且只在库内确有该 category 时生效。 */
    private static final Map<String, String> CATEGORY_ALIASES = Map.of("乌龙", "青茶");

    /** 意图关键词：先定意图（问水温还是问时间），再定对象（具体茶 / 茶类），两句问同一款茶才答得对。 */
    private static final List<String> TEMP_HINTS =
            List.of("水温", "多少度", "几度", "温度", "℃", "沸水", "开水", "摄氏");
    private static final List<String> TIME_HINTS =
            List.of("多久", "几分钟", "几秒", "多少秒", "出汤", "多长时间", "泡几", "闷多久");
    private static final List<String> VESSEL_HINTS =
            List.of("多少克", "投茶", "盖碗", "紫砂", "玻璃杯", "茶器", "器具", "器皿", "用什么泡");
    private static final List<String> INTRO_HINTS =
            List.of("介绍", "是什么", "什么茶", "特点", "怎么样", "什么味道", "来历", "故事", "讲讲");

    private final List<TeaFact> teas;
    private final List<TeawareFact> teawares;
    /** category → 基准区间（由入参聚合，非硬编码）。 */
    private final Map<String, CategoryBaseline> baselines;
    /** 长名优先：「安吉白茶」「白毫银针」这类名称互相包含时，取最具体的一条。 */
    private final List<String> teaNamesByLengthDesc;

    public AiLocalRuleEngine(List<TeaFact> teas, List<TeawareFact> teawares) {
        this.teas = teas == null ? List.of() : teas.stream()
                .filter(t -> t != null && t.name() != null && !t.name().isBlank())
                .toList();
        this.teawares = teawares == null ? List.of() : teawares.stream()
                .filter(w -> w != null && w.name() != null && !w.name().isBlank())
                .toList();
        this.baselines = buildBaselines(this.teas);
        this.teaNamesByLengthDesc = this.teas.stream().map(TeaFact::name).distinct()
                .sorted(Comparator.comparingInt(String::length).reversed())
                .toList();
    }

    /** 兜底入口：命中返回答复，未命中返回 empty（未命中不是错误，调用方据此继续走其它降级策略）。 */
    public Optional<String> answer(String question) {
        return match(question).map(Hit::answer);
    }

    /** 带规则标签的命中（Service 用它给 tea.ai.fallback.hit{rule} 打点）。 */
    public Optional<Hit> match(String question) {
        try {
            return resolve(question);
        } catch (RuntimeException e) {
            // 兜底引擎自身异常不允许外溢：脏数据/畸形入参都降级为「未命中」，不能升级成业务异常。
            return Optional.empty();
        }
    }

    private Optional<Hit> resolve(String question) {
        if (question == null) {
            return Optional.empty();
        }
        String q = question.strip();
        if (q.isEmpty() || q.length() > MAX_QUESTION_CHARS) {
            return Optional.empty();
        }
        TeaFact tea = findTea(q);
        String category = tea != null ? tea.category() : findCategory(q);
        return switch (detectIntent(q)) {
            case TEMP -> waterTemp(tea, category);
            case TIME -> steepTime(tea, category);
            case VESSEL -> vessel(q, category);
            // 「只提了茶名/茶类」等于想了解它，与显式介绍意图同路
            case INTRO, NONE -> intro(tea, category);
        };
    }

    // ---- 规则 1/2：水温与冲泡时间（具体茶优先用该茶参数，否则回落茶类区间）----

    private Optional<Hit> waterTemp(TeaFact tea, String category) {
        if (tea != null && tea.bestTemp() != null) {
            return Optional.of(new Hit(RULE_WATER_TEMP, limit(tea.name() + "：" + params(tea) + "。")));
        }
        CategoryBaseline base = baseline(category);
        if (base == null || base.minTemp() == null) {
            return Optional.empty();
        }
        return Optional.of(new Hit(RULE_WATER_TEMP, limit(base.category() + "宜 "
                + range(base.minTemp(), base.maxTemp(), "℃") + " 冲泡" + timeClause(base) + "。")));
    }

    private Optional<Hit> steepTime(TeaFact tea, String category) {
        if (tea != null && tea.bestTime() != null) {
            return Optional.of(new Hit(RULE_STEEP_TIME, limit(tea.name() + "：" + params(tea) + "。")));
        }
        CategoryBaseline base = baseline(category);
        if (base == null || base.minTime() == null) {
            return Optional.empty();
        }
        return Optional.of(new Hit(RULE_STEEP_TIME, limit(base.category() + "首泡 "
                + range(base.minTime(), base.maxTime(), " 秒") + tempClause(base) + "。")));
    }

    // ---- 规则 3：投茶量 / 器具 ----

    /**
     * 器具规则：先认问句里点到的器具（库内名称/器型的子串，长匹配优先），认不到再按茶类反查推荐器具。
     * 投茶建议用器具容量换算（teawares.capacity），器具话术只用库内 description 摘要。
     */
    private Optional<Hit> vessel(String q, String category) {
        TeawareFact ware = findTeawareInQuestion(q);
        if (ware == null) {
            ware = recommendTeaware(category);
        }
        if (ware == null) {
            return Optional.empty();
        }
        List<String> parts = new ArrayList<>();
        String detail = joinNonBlank("，", blankToNull(ware.material()),
                ware.capacity() == null ? null : ware.capacity() + "ml");
        parts.add(detail.isEmpty() ? ware.name() : ware.name() + "（" + detail + "）");
        if (ware.capacity() != null) {
            parts.add("每 " + ware.capacity() + "ml 约投茶 " + grams(ware.capacity())
                    + "g（茶水比 1:" + ML_PER_GRAM + "）");
        }
        String preview = preview(ware.description());
        if (preview != null) {
            parts.add(preview);
        }
        return Optional.of(new Hit(RULE_VESSEL, limit(String.join("；", parts) + "。")));
    }

    /** 问句里点名的器具：库内名称的任意 ≥2 字子串 / 器型名命中即算，长匹配优先（青瓷盖碗 胜过 盖碗）。 */
    private TeawareFact findTeawareInQuestion(String q) {
        TeawareFact best = null;
        int bestLength = 0;
        for (TeawareFact ware : teawares) {
            if (ware.wareType() != null && q.contains(ware.wareType()) && ware.wareType().length() > bestLength) {
                best = ware;
                bestLength = ware.wareType().length();
            }
            for (String token : nameTokens(ware.name())) {
                if (q.contains(token) && token.length() > bestLength) {
                    best = ware;
                    bestLength = token.length();
                }
            }
        }
        return best;
    }

    private TeawareFact recommendTeaware(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        return teawares.stream()
                .filter(w -> w.recommendedCategories() != null && w.recommendedCategories().contains(category))
                .findFirst()
                .orElse(null);
    }

    // ---- 规则 4：茶类介绍（具体茶名 → 该茶简介；只提茶类 → 茶类概览）----

    private Optional<Hit> intro(TeaFact tea, String category) {
        if (tea != null) {
            List<String> parts = new ArrayList<>();
            parts.add(tea.name() + "（" + joinNonBlank("，", blankToNull(tea.category()), blankToNull(tea.origin())) + "）");
            String params = params(tea);
            if (!params.isEmpty()) {
                parts.add(params);
            }
            String preview = preview(tea.description());
            if (preview != null) {
                parts.add(preview);
            }
            return Optional.of(new Hit(RULE_TEA_INTRO, limit(String.join("；", parts) + "。")));
        }
        CategoryBaseline base = baseline(category);
        if (base == null) {
            return Optional.empty();
        }
        List<String> parts = new ArrayList<>();
        parts.add(category + "（库内 " + base.count() + " 款）：水温 " + rangeOrDash(base.minTemp(), base.maxTemp(), "℃")
                + "，首泡 " + rangeOrDash(base.minTime(), base.maxTime(), " 秒"));
        if (!base.sampleNames().isEmpty()) {
            parts.add("代表茶：" + String.join("、", base.sampleNames()));
        }
        return Optional.of(new Hit(RULE_CATEGORY_INTRO, limit(String.join("；", parts) + "。")));
    }

    // ---- 匹配工具 ----

    private TeaFact findTea(String q) {
        for (String name : teaNamesByLengthDesc) {
            if (q.contains(name)) {
                return teas.stream().filter(t -> name.equals(t.name())).findFirst().orElse(null);
            }
        }
        return null;
    }

    private String findCategory(String q) {
        for (String category : baselines.keySet()) {
            if (q.contains(category)) {
                return category;
            }
        }
        for (Map.Entry<String, String> alias : CATEGORY_ALIASES.entrySet()) {
            if (q.contains(alias.getKey()) && baselines.containsKey(alias.getValue())) {
                return alias.getValue();
            }
        }
        return null;
    }

    private Intent detectIntent(String q) {
        if (containsAny(q, TEMP_HINTS)) {
            return Intent.TEMP;
        }
        if (containsAny(q, TIME_HINTS)) {
            return Intent.TIME;
        }
        if (containsAny(q, VESSEL_HINTS)) {
            return Intent.VESSEL;
        }
        if (containsAny(q, INTRO_HINTS)) {
            return Intent.INTRO;
        }
        return Intent.NONE;
    }

    private static boolean containsAny(String q, List<String> hints) {
        for (String hint : hints) {
            if (q.contains(hint)) {
                return true;
            }
        }
        return false;
    }

    private CategoryBaseline baseline(String category) {
        return category == null ? null : baselines.get(category);
    }

    /** 按入参聚合各茶类基准区间（min/max，不是均值：区间才是有用的冲泡提示）。 */
    private static Map<String, CategoryBaseline> buildBaselines(List<TeaFact> teas) {
        Map<String, List<TeaFact>> grouped = new LinkedHashMap<>();
        for (TeaFact tea : teas) {
            if (tea.category() == null || tea.category().isBlank()) {
                continue;
            }
            grouped.computeIfAbsent(tea.category(), k -> new ArrayList<>()).add(tea);
        }
        Map<String, CategoryBaseline> result = new LinkedHashMap<>();
        grouped.forEach((category, members) -> {
            Integer minTemp = null;
            Integer maxTemp = null;
            Integer minTime = null;
            Integer maxTime = null;
            List<String> names = new ArrayList<>();
            for (TeaFact tea : members) {
                if (tea.bestTemp() != null) {
                    minTemp = minTemp == null ? tea.bestTemp() : Math.min(minTemp, tea.bestTemp());
                    maxTemp = maxTemp == null ? tea.bestTemp() : Math.max(maxTemp, tea.bestTemp());
                }
                if (tea.bestTime() != null) {
                    minTime = minTime == null ? tea.bestTime() : Math.min(minTime, tea.bestTime());
                    maxTime = maxTime == null ? tea.bestTime() : Math.max(maxTime, tea.bestTime());
                }
                if (names.size() < 3) {
                    names.add(tea.name());
                }
            }
            result.put(category, new CategoryBaseline(category, members.size(), minTemp, maxTemp,
                    minTime, maxTime, names));
        });
        return result;
    }

    private static String params(TeaFact tea) {
        List<String> parts = new ArrayList<>();
        if (tea.bestTemp() != null) {
            parts.add("宜 " + tea.bestTemp() + "℃ 水温");
        }
        if (tea.bestTime() != null) {
            parts.add("首泡约 " + tea.bestTime() + " 秒");
        }
        if (tea.infusions() != null) {
            parts.add("可冲泡 " + tea.infusions() + " 泡");
        }
        return String.join("，", parts);
    }

    private static String tempClause(CategoryBaseline base) {
        return base.minTemp() == null ? "" : "（库内 " + base.category() + "水温 "
                + range(base.minTemp(), base.maxTemp(), "℃") + "）";
    }

    private static String timeClause(CategoryBaseline base) {
        return base.minTime() == null ? "" : "，首泡 " + range(base.minTime(), base.maxTime(), " 秒");
    }

    private static String range(Integer min, Integer max, String unit) {
        if (min == null || max == null) {
            return "-";
        }
        return min.equals(max) ? min + unit : min + "-" + max + unit;
    }

    private static String rangeOrDash(Integer min, Integer max, String unit) {
        return min == null || max == null ? "—" : range(min, max, unit);
    }

    /** 投茶克数：容量 / 茶水比，保留 1 位小数并去掉多余的 .0（150ml → 3g，80ml → 1.6g）。 */
    private static String grams(int capacityMl) {
        double value = Math.round(capacityMl * 10.0 / ML_PER_GRAM) / 10.0;
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    /** 名称的 ≥2 字子串（用于识别问句里点到的器物：青瓷盖碗 → 青瓷 / 瓷盖 / 盖碗 …）。 */
    private static List<String> nameTokens(String name) {
        List<String> tokens = new ArrayList<>();
        for (int i = 0; i < name.length(); i++) {
            for (int j = i + 2; j <= name.length(); j++) {
                tokens.add(name.substring(i, j));
            }
        }
        return tokens;
    }

    private static String preview(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        // 去掉尾部标点：拼接句号由调用方统一加，否则会出现「……鼻祖。。」
        String flat = text.strip().replaceAll("\\s+", " ").replaceAll("[。；;，,！!？?\\s]+$", "");
        return flat.length() <= PREVIEW_CHARS ? flat : flat.substring(0, PREVIEW_CHARS) + "…";
    }

    private static String limit(String answer) {
        return answer.length() <= MAX_ANSWER_CHARS ? answer : answer.substring(0, MAX_ANSWER_CHARS) + "…";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static String joinNonBlank(String delimiter, String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                parts.add(value);
            }
        }
        return String.join(delimiter, parts);
    }

    /** 问句意图：温度 / 时间 / 器具 / 介绍 / 未表达（只提了茶名或茶类）。 */
    private enum Intent { TEMP, TIME, VESSEL, INTRO, NONE }

    /** 茶类基准区间（由库内该茶类各茶的 best_temp / best_time 聚合而来）。 */
    private record CategoryBaseline(String category, int count, Integer minTemp, Integer maxTemp,
                                    Integer minTime, Integer maxTime, List<String> sampleNames) {
    }
}
