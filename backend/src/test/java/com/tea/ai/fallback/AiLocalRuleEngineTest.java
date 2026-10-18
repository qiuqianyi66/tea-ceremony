package com.tea.ai.fallback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.tea.ai.fallback.AiLocalRuleEngine.TeaFact;
import com.tea.ai.fallback.AiLocalRuleEngine.TeawareFact;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * 本地规则库兜底引擎：五类规则的命中/未命中 + 边界输入。
 *
 * 测试数据是「数据库快照的最小样本」（teas / teawares 种子行的真实参数），
 * 但引擎里没有任何茶名/参数常量——见 dataDrivenBaselineFollowsFacts 用例：
 * 换一份事实数据，答复口径必须跟着变。
 *
 * 每类规则都断言「未命中返回 empty 而不是抛异常」：兜底路径抛异常会把本已降级的请求再打断一次。
 */
class AiLocalRuleEngineTest {

    private static final List<TeaFact> TEAS = List.of(
            new TeaFact("西湖龙井", "绿茶", 80, 60, 3, "浙江杭州", "扁平光滑，色泽翠绿，香气清高。"),
            new TeaFact("碧螺春", "绿茶", 75, 45, 3, "江苏苏州", "卷曲如螺，银绿隐翠，花果香天成。"),
            new TeaFact("安吉白茶", "绿茶", 80, 45, 3, "浙江安吉", "白化品种绿茶，氨基酸含量突出。"),
            new TeaFact("白毫银针", "白茶", 85, 120, 5, "福建福鼎", "满披白毫如银似雪。"),
            new TeaFact("君山银针", "黄茶", 85, 75, 4, "湖南岳阳", "冲泡时三起三落。"),
            new TeaFact("铁观音", "青茶", 95, 45, 7, "福建安溪", "半发酵，兼具清香与醇厚。"),
            new TeaFact("正山小种", "红茶", 90, 60, 5, "福建武夷山", "松烟香，世界红茶鼻祖。"),
            new TeaFact("老班章普洱", "黑茶", 100, 30, 15, "云南勐海", "茶气刚烈，回甘持久。"));

    private static final List<TeawareFact> WARES = List.of(
            new TeawareFact("白瓷盖碗", "盖碗", "白瓷（釉面）", 150, "釉面光滑不吸味，出汤速度可控。",
                    List.of("绿茶", "白茶", "青茶")),
            new TeawareFact("紫砂壶", "紫砂壶", "宜兴紫砂", 150, "双气孔结构保温性极佳，建议一壶一茶。",
                    List.of("黑茶", "红茶", "青茶")),
            new TeawareFact("玻璃杯", "玻璃杯", "高硼硅玻璃", 300, "透明度高，可欣赏茶叶舒展。",
                    List.of("绿茶", "白茶", "黄茶")));

    private final AiLocalRuleEngine engine = new AiLocalRuleEngine(TEAS, WARES);

    // ---- 规则 1：水温 ----

    @Test
    void waterTempHitsOnCategoryKeyword() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("绿茶水温多少度合适");

        assertThat(hit).isPresent();
        assertThat(hit.get().rule()).isEqualTo(AiLocalRuleEngine.RULE_WATER_TEMP);
        // 库内绿茶三条样本 75/80/80 → 区间 75-80℃（区间由事实聚合，不是写死的 80-85）
        assertThat(hit.get().answer()).contains("75-80℃");
    }

    @Test
    void waterTempPrefersConcreteTeaOverCategory() {
        // 「安吉白茶」含「白茶」二字：长名优先必须命中安吉白茶（绿茶，80℃），不能错答白茶 85℃
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("安吉白茶水温多少");

        assertThat(hit).isPresent();
        assertThat(hit.get().answer()).contains("安吉白茶").contains("80℃");
    }

    @Test
    void waterTempMissesWithoutSubject() {
        assertThat(engine.answer("水温多少度合适")).isEmpty();
    }

    // ---- 规则 2：冲泡时间 ----

    @Test
    void steepTimeHitsOnTeaNameWithTimeIntent() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("铁观音泡多久出汤");

        assertThat(hit).isPresent();
        assertThat(hit.get().rule()).isEqualTo(AiLocalRuleEngine.RULE_STEEP_TIME);
        assertThat(hit.get().answer()).contains("45 秒").contains("7 泡");
    }

    @Test
    void steepTimeHitsOnCategoryRange() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("红茶要闷多久");

        assertThat(hit).isPresent();
        assertThat(hit.get().answer()).contains("首泡 60 秒");
    }

    @Test
    void steepTimeMissesWithoutSubject() {
        assertThat(engine.answer("快递多久能到")).isEmpty();
    }

    // ---- 规则 3：投茶量 / 器具 ----

    @Test
    void vesselHitsNamedWareAndGivesTeaWeight() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("盖碗泡绿茶要投多少克");

        assertThat(hit).isPresent();
        assertThat(hit.get().rule()).isEqualTo(AiLocalRuleEngine.RULE_VESSEL);
        assertThat(hit.get().answer()).contains("白瓷盖碗").contains("150ml").contains("3g");
    }

    @Test
    void vesselRecommendsWareByTeaCategoryWhenNoneNamed() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("红茶用什么器具");

        assertThat(hit).isPresent();
        assertThat(hit.get().answer()).contains("紫砂壶");
    }

    @Test
    void vesselHitsNamedWareWithoutAnyTea() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("玻璃杯怎么用");

        assertThat(hit).isPresent();
        assertThat(hit.get().answer()).contains("玻璃杯").contains("300ml");
    }

    @Test
    void vesselMissesWhenNeitherWareNorTeaKnown() {
        assertThat(engine.answer("要投多少克")).isEmpty();
    }

    // ---- 规则 4：茶类介绍（具体茶名）----

    @Test
    void teaIntroHitsOnConcreteTeaName() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("正山小种是什么茶");

        assertThat(hit).isPresent();
        assertThat(hit.get().rule()).isEqualTo(AiLocalRuleEngine.RULE_TEA_INTRO);
        assertThat(hit.get().answer()).contains("正山小种").contains("红茶").contains("90℃");
    }

    @Test
    void teaIntroHitsWhenOnlyTeaNameGiven() {
        // 只提茶名（无意图词）也是「想了解它」，不能返回 empty
        assertThat(engine.answer("老班章普洱")).isPresent();
    }

    @Test
    void teaIntroMissesWhenOnlyIntentGiven() {
        assertThat(engine.answer("这是什么茶")).isEmpty();
    }

    // ---- 规则 5：茶类概览 + 数据驱动 ----

    @Test
    void categoryIntroHitsWhenOnlyCategoryGiven() {
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("白茶");

        assertThat(hit).isPresent();
        assertThat(hit.get().rule()).isEqualTo(AiLocalRuleEngine.RULE_CATEGORY_INTRO);
        assertThat(hit.get().answer()).contains("库内 1 款").contains("白毫银针");
    }

    @Test
    void categoryAliasMapsToStoredCategory() {
        // 「乌龙」不在库内 category 值里，靠别名映射到「青茶」
        Optional<AiLocalRuleEngine.Hit> hit = engine.match("乌龙茶水温");

        assertThat(hit).isPresent();
        assertThat(hit.get().answer()).contains("青茶");
    }

    @Test
    void dataDrivenBaselineFollowsFacts() {
        // 同一套规则，只换事实数据：基准参数必须跟着数据走（证明规则引擎没有写死茶类参数）
        AiLocalRuleEngine alone = new AiLocalRuleEngine(
                List.of(new TeaFact("某款青茶", "青茶", 88, 33, 6, null, "测试用茶。")), List.of());

        assertThat(alone.answer("青茶水温多少")).hasValueSatisfying(
                answer -> assertThat(answer).contains("88℃"));
        assertThat(alone.answer("青茶泡多久")).hasValueSatisfying(
                answer -> assertThat(answer).contains("33 秒"));
    }

    // ---- 边界：空 / 无关 / 超长 —— 只允许 empty，不允许抛 ----

    @Test
    void blankOrNullInputsReturnEmpty() {
        assertThat(engine.answer(null)).isEmpty();
        assertThat(engine.answer("")).isEmpty();
        assertThat(engine.answer("   ")).isEmpty();
        assertThat(engine.match(null)).isEmpty();
    }

    @Test
    void unrelatedQuestionReturnsEmpty() {
        assertThat(engine.answer("帮我写一个 Java 快速排序")).isEmpty();
        assertThat(engine.answer("明天上海会下雨吗")).isEmpty();
    }

    @Test
    void overlongQuestionReturnsEmpty() {
        String longInput = "绿茶水温多少度".repeat(200); // 1400 字，超过 500 字上限

        assertThat(engine.answer(longInput)).isEmpty();
        assertThat(longInput.length()).isGreaterThan(500);
    }

    @Test
    void neverThrowsOnAnyInput() {
        List<String> odd = List.of("", " ", "茶", "绿茶", "🍵🍵", "\u0000\u0001", "盖碗", "多少度",
                "多久多久多久多久多久", "水温".repeat(300), "投茶".repeat(300));

        assertThatCode(() -> odd.forEach(engine::answer)).doesNotThrowAnyException();
        assertThatCode(() -> engine.answer(null)).doesNotThrowAnyException();
    }

    @Test
    void emptyFactsYieldNoAnswers() {
        AiLocalRuleEngine blank = new AiLocalRuleEngine(null, null);

        assertThat(blank.answer("绿茶水温多少")).isEmpty();
        assertThat(blank.answer("盖碗怎么用")).isEmpty();
        assertThat(blank.answer("铁观音是什么茶")).isEmpty();
    }
}
