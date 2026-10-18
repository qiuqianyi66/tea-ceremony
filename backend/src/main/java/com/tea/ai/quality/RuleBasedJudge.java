package com.tea.ai.quality;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 规则版质量评分器：零依赖纯函数，LLM 不可用时的降级路径，也是「不烧钱」的默认路径。
 *
 * 为什么必须有确定性版本：LLM 评分烧钱且会抖动（没配 key / 熔断 / 上游 502 / 额度耗尽都会断链）。
 * 质量分是旁路能力，不能让评分链路把服务或定时任务打挂；规则版永远能给出可解释的分。
 *
 * 四维口径（唯一解释点，聚合报表不再二次解释）：
 * 1. relevance：问题与回答的中文 2-gram 重合率（去停用词后），≥0.5→5 / ≥0.3→4 / ≥0.15→3 / >0→2 / 0→1；
 * 2. groundedness：5 分起扣——编造茶名（形如「XX茶」且 teas 表查不到）-2/个（最多 -4）；
 *    温度越界（不在该茶类合理区间）-1/个（最多 -2）；无检索依据却给出具体参数 -1；
 * 3. actionability：温度 / 时间 / 投茶量三要素命中 3→5、2→4、1→3、0→1；
 * 4. tone：客服腔黑名单每命中一类 -2（最低 1）。
 *
 * 已知边界（写成注释而不是藏着，避免把规则分当真理）：
 * 1. 只能识别「XX茶」形态的编造茶名；「仙雾龙井」这类无「茶」后缀的编造名识别不到（LLM 版覆盖）；
 * 2. 语气只靠黑名单，判不出「礼貌但冰冷」；可操作性只数要素是否出现，不判参数本身对不对；
 * 3. 茶表不可读时跳过「编造茶名」扣分（见 TeaFacts#isEmpty），否则会用空目录冤枉所有正确茶名。
 */
@Component
public class RuleBasedJudge {

    public static final String VERSION = "rule-v1";

    /** 单条回答参与分析的字符上限：超长回答只看前 2000 字，保证评分耗时与回答长度无关。 */
    static final int MAX_ANALYZE_CHARS = 2000;

    /** 全局合理冲泡水温带（六大茶类的并集，再宽就是明显不合理）。 */
    static final int GLOBAL_MIN_TEMP = 60;
    static final int GLOBAL_MAX_TEMP = 100;

    /** 六大茶类的合理水温区间（摄氏度）。来源：tea-tasting 基准表口径。 */
    static final Map<String, int[]> CATEGORY_TEMP_RANGE = Map.of(
            "绿茶", new int[] {70, 85},
            "白茶", new int[] {80, 95},
            "黄茶", new int[] {75, 90},
            "青茶", new int[] {90, 100},
            "红茶", new int[] {85, 100},
            "黑茶", new int[] {95, 100});

    /** 常见别名 → 库内茶类名（回答里说「乌龙茶」，库里分类是「青茶」）。 */
    static final Map<String, String> CATEGORY_ALIAS = Map.of(
            "乌龙茶", "青茶",
            "岩茶", "青茶",
            "普洱茶", "黑茶");

    /** 2-gram 前剔除的停用词：不剔的话「的/是/多少」会让任意两句都产生伪重合。 */
    static final List<String> STOPWORDS = List.of(
            "的", "了", "吗", "呢", "吧", "啊", "呀", "是", "在", "有", "和", "与", "就", "都", "也",
            "很", "太", "还", "我", "你", "他", "她", "它", "请", "一下", "什么", "怎么", "怎样",
            "如何", "多少", "多久", "为什么", "可以", "需要", "应该", "这个", "那个", "那么",
            "谢谢", "你好", "请问");

    /** 停用词按长度倒序（「什么」先于「什」删除，否则会留下孤字碎片）；预排序而不是运行时排序，避免共享可变集合。 */
    private static final List<String> STOPWORDS_BY_LENGTH_DESC = STOPWORDS.stream()
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();

    /** 不是茶名、只是「关于茶的通用说法」的词：出现它们不扣有据性分。 */
    static final Set<String> GENERIC_TEA_WORDS = Set.of(
            "泡茶", "喝茶", "喝杯茶", "喝口茶", "品茶", "饮茶", "煮茶", "煎茶", "点茶", "沏茶", "冲茶",
            "出茶", "分茶", "奉茶", "敬茶", "备茶", "洗茶", "醒茶", "温茶", "焖茶", "煮壶茶", "泡杯茶",
            "一杯茶", "一盏茶", "一壶茶", "一泡茶", "一道茶", "这杯茶", "这壶茶", "那杯茶",
            "好茶", "老茶", "新茶", "名茶", "贡茶", "御茶", "土茶", "野茶", "山茶", "古树茶",
            "台地茶", "荒野茶", "春茶", "夏茶", "秋茶", "冬茶", "明前茶", "雨前茶", "头采茶",
            "绿茶", "红茶", "白茶", "黑茶", "黄茶", "青茶", "乌龙茶", "花茶", "药茶", "果茶",
            "奶茶", "油茶", "凉茶", "热茶", "冷泡茶", "浓茶", "淡茶", "清茶", "甜茶", "苦茶",
            "香茶", "散茶", "紧压茶", "袋泡茶", "原叶茶", "生茶", "熟茶", "老白茶", "新白茶");

    /** 包含这些片段的「XX茶」不是茶名（茶叶/茶汤/茶席这类「茶+物品」的通用说法）。 */
    static final List<String> GENERIC_TEA_FRAGMENTS = List.of(
            "茶叶", "茶汤", "茶香", "茶味", "茶气", "茶性", "茶席", "茶器", "茶具", "茶室", "茶道",
            "茶艺", "茶人", "茶事", "茶礼", "茶业", "茶馆", "茶楼", "茶农", "茶山", "茶园", "茶区",
            "茶厂", "茶商", "茶友", "茶客", "茶渣", "茶末", "茶粉", "茶膏", "茶油", "茶点", "茶食");

    /**
     * 「量词/助词 + 茶」永远不是茶名（一杯茶、煮一壶茶、买的茶）。
     * 用「茶前一个字」判定，比穷举「一杯茶/一壶茶/…」更省事，也不会漏掉没列到的组合。
     */
    static final String MEASURE_OR_PARTICLE = "杯盏壶泡饼撮罐袋盒包提筒碗匙勺把片块根粒颗的得了着些这那点";

    /** 客服腔黑名单：命中即扣分。用正则而不是 contains，是因为「亲」在「母亲」「亲手」里不该算客服腔。 */
    static final List<Pattern> SERVICE_TONE_PATTERNS = List.of(
            Pattern.compile("(?:^|[，。！？、；：\\s])亲(?:[，,～~！!]|$|您)"),
            Pattern.compile("亲爱的"),
            Pattern.compile("很高兴为您"),
            Pattern.compile("如有疑问请随时"),
            Pattern.compile("请随时联系我们"),
            Pattern.compile("欢迎咨询"),
            Pattern.compile("感谢您的支持"),
            Pattern.compile("希望对您有帮助"),
            Pattern.compile("为您服务"),
            Pattern.compile("客服"));

    /** 「XX茶」形态的茶名候选（2-4 个汉字 + 茶）。 */
    private static final Pattern TEA_NAME_LIKE = Pattern.compile("[\\u4e00-\\u9fa5]{2,4}茶");

    private static final Pattern TEMPERATURE = Pattern.compile("\\d{1,3}\\s*(?:℃|°C|摄氏度|度)");
    private static final Pattern TEMP_VALUE = Pattern.compile("(\\d{1,3})\\s*(?:℃|°C|摄氏度|度)");
    private static final Pattern DURATION = Pattern.compile("\\d{1,3}\\s*(?:秒|分钟|min\\b|s\\b)");
    private static final Pattern AMOUNT = Pattern.compile(
            "\\d+(?:\\.\\d+)?\\s*(?:克|g\\b|毫升|ml\\b|ML)|投茶量|茶水比");

    /** 评分入口（纯函数：同输入必同输出，不读时钟、不读库）。 */
    public QualityScore judge(JudgeInput input, TeaFacts facts) {
        String answer = input.answer();
        if (answer.isBlank()) {
            // 空回答四维全 1：这不是「判不了」，是「确实没答」
            return new QualityScore(1, 1, 1, 1, VERSION);
        }
        String analyzed = truncate(answer);
        return new QualityScore(
                relevance(input.question(), analyzed),
                groundedness(analyzed, facts, input.hasRetrieval()),
                actionability(analyzed),
                tone(analyzed),
                VERSION);
    }

    // ---------------------------------------------------------------- relevance

    int relevance(String question, String answer) {
        Set<String> questionGrams = bigrams(question);
        if (questionGrams.isEmpty()) {
            // 问题为空/太短（"你好""泡茶"）时重合率无意义：给中性分，不因判不了而扣分
            return 3;
        }
        Set<String> answerGrams = bigrams(answer);
        int overlap = 0;
        for (String gram : questionGrams) {
            if (answerGrams.contains(gram)) {
                overlap++;
            }
        }
        double ratio = overlap / (double) questionGrams.size();
        if (ratio >= 0.5) {
            return 5;
        }
        if (ratio >= 0.3) {
            return 4;
        }
        if (ratio >= 0.15) {
            return 3;
        }
        return ratio > 0 ? 2 : 1;
    }

    private static Set<String> bigrams(String text) {
        String cleaned = normalize(text);
        Set<String> grams = new LinkedHashSet<>();
        for (int i = 0; i + 1 < cleaned.length(); i++) {
            grams.add(cleaned.substring(i, i + 2));
        }
        return grams;
    }

    /** 归一：小写 + 去空白与中英标点 + 去停用词（长的先删，避免「什么」被「什」截断后残留碎片）。 */
    private static String normalize(String text) {
        String s = text.toLowerCase(Locale.ROOT)
                .replaceAll("[\\s\\p{Punct}，。！？、；：“”‘’（）《》【】…—～·]", "");
        for (String stop : STOPWORDS_BY_LENGTH_DESC) {
            s = s.replace(stop, "");
        }
        return s;
    }

    // -------------------------------------------------------------- groundedness

    int groundedness(String answer, TeaFacts facts, boolean hasRetrieval) {
        int score = 5;
        if (!facts.isEmpty()) {
            score -= Math.min(2, unknownTeaNames(answer, facts).size()) * 2;
        }
        score -= Math.min(2, outOfRangeTemps(answer, facts));
        if (!hasRetrieval && hasBrewNumbers(answer)) {
            // 这一轮没有检索到任何茶数据，却给出具体水温/时间/用量：大概率是模型自己编的参数
            score -= 1;
        }
        return QualityScore.clamp(score);
    }

    /** 形似茶名但 teas 表里没有的名称（含库内茶名的长词如「西湖龙井茶」不算编造）。 */
    List<String> unknownTeaNames(String answer, TeaFacts facts) {
        List<String> suspects = new ArrayList<>();
        Matcher matcher = TEA_NAME_LIKE.matcher(answer);
        while (matcher.find()) {
            String token = matcher.group();
            if (isGenericTeaWord(token)) {
                continue;
            }
            if (containsKnownTea(token, facts)) {
                continue;
            }
            if (suspects.contains(token)) {
                continue;
            }
            suspects.add(token);
        }
        return suspects;
    }

    /**
     * 「关于茶的通用说法」判定：精确词表 + 「茶叶/茶汤…」片段 + 「量词/助词 + 茶」形态。
     * 为什么需要三层：中文里「买的茶」「煮一壶茶」都能被「XX茶」正则命中，
     * 只靠词表会不断补词；用「茶前一个字是量词/助词」这条结构规则能一次覆盖大部分组合。
     */
    static boolean isGenericTeaWord(String token) {
        if (GENERIC_TEA_WORDS.contains(token)) {
            return true;
        }
        for (String fragment : GENERIC_TEA_FRAGMENTS) {
            if (token.contains(fragment)) {
                return true;
            }
        }
        return token.length() >= 2 && MEASURE_OR_PARTICLE.indexOf(token.charAt(token.length() - 2)) >= 0;
    }

    private static boolean containsKnownTea(String token, TeaFacts facts) {
        for (String name : facts.teaNames()) {
            if (token.contains(name)) {
                return true;
            }
        }
        return false;
    }

    /** 越界温度个数（同一数值只算一次）：区间优先级 = 茶类区间 > 单品 best_temp ±10 > 全局 60-100。 */
    int outOfRangeTemps(String answer, TeaFacts facts) {
        int[] range = tempRange(answer, facts);
        Set<Integer> seen = new LinkedHashSet<>();
        int bad = 0;
        Matcher matcher = TEMP_VALUE.matcher(answer);
        while (matcher.find()) {
            int value;
            try {
                value = Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException e) {
                continue;
            }
            if (!seen.add(value)) {
                continue;
            }
            if (value < GLOBAL_MIN_TEMP || value > GLOBAL_MAX_TEMP || value < range[0] || value > range[1]) {
                bad++;
            }
        }
        return bad;
    }

    private int[] tempRange(String answer, TeaFacts facts) {
        String category = categoryIn(answer, facts);
        int[] range = category == null ? null : CATEGORY_TEMP_RANGE.get(category);
        if (range != null) {
            return range;
        }
        Integer best = bestTempIn(answer, facts);
        if (best != null) {
            return new int[] {
                    Math.max(GLOBAL_MIN_TEMP, best - 10),
                    Math.min(GLOBAL_MAX_TEMP, best + 10)};
        }
        return new int[] {GLOBAL_MIN_TEMP, GLOBAL_MAX_TEMP};
    }

    private String categoryIn(String answer, TeaFacts facts) {
        for (String name : facts.teaNames()) {
            if (answer.contains(name)) {
                String category = facts.categoryByTea().get(name);
                if (category != null) {
                    return category;
                }
            }
        }
        for (String category : facts.categories()) {
            if (answer.contains(category)) {
                return category;
            }
        }
        for (Map.Entry<String, String> alias : CATEGORY_ALIAS.entrySet()) {
            if (answer.contains(alias.getKey())) {
                return alias.getValue();
            }
        }
        return null;
    }

    private Integer bestTempIn(String answer, TeaFacts facts) {
        for (String name : facts.teaNames()) {
            if (answer.contains(name)) {
                Integer best = facts.bestTempByTea().get(name);
                if (best != null) {
                    return best;
                }
            }
        }
        return null;
    }

    private static boolean hasBrewNumbers(String answer) {
        return TEMPERATURE.matcher(answer).find()
                || DURATION.matcher(answer).find()
                || AMOUNT.matcher(answer).find();
    }

    // ------------------------------------------------------------- actionability

    int actionability(String answer) {
        int hits = 0;
        if (TEMPERATURE.matcher(answer).find()) {
            hits++;
        }
        if (DURATION.matcher(answer).find()) {
            hits++;
        }
        if (AMOUNT.matcher(answer).find()) {
            hits++;
        }
        return switch (hits) {
            case 3 -> 5;
            case 2 -> 4;
            case 1 -> 3;
            default -> 1;
        };
    }

    // --------------------------------------------------------------------- tone

    int tone(String answer) {
        int hits = 0;
        for (Pattern pattern : SERVICE_TONE_PATTERNS) {
            if (pattern.matcher(answer).find()) {
                hits++;
            }
        }
        return QualityScore.clamp(5 - 2 * hits);
    }

    private static String truncate(String answer) {
        return answer.length() <= MAX_ANALYZE_CHARS ? answer : answer.substring(0, MAX_ANALYZE_CHARS);
    }
}
