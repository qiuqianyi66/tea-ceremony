package com.tea.ai.quality;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * 规则版评分器的口径测试：每个维度至少一组正例/反例，外加空回答、超长回答、无检索、编造茶名、
 * 客服腔、温度越界六类边界。
 *
 * 为什么不需要 Spring/Mockito：规则版是纯函数（输入 → 分数），启动上下文只会让「算错」变成「启动失败」。
 * 断言直接绑定分数而不是「大于某值」，是为了让口径改动在测试里显形而不是悄悄漂移。
 */
class RuleBasedJudgeTest {

    private final RuleBasedJudge judge = new RuleBasedJudge();

    /** 三款代表性茶：绿茶 80 / 青茶 95 / 白茶 85，覆盖三种温度区间。 */
    private final TeaFacts facts = new TeaFacts(
            Set.of("西湖龙井", "铁观音", "白毫银针"),
            Set.of("绿茶", "白茶", "青茶"),
            Map.of("西湖龙井", "绿茶", "铁观音", "青茶", "白毫银针", "白茶"),
            Map.of("西湖龙井", 80, "铁观音", 95, "白毫银针", 85));

    private JudgeInput input(String question, String answer) {
        return new JudgeInput(question, answer, true, "brewer");
    }

    // ------------------------------------------------------------ relevance

    @Test
    void relevanceHighWhenAnswerEchoesQuestion() {
        QualityScore score = judge.judge(
                input("铁观音的冲泡水温是多少", "铁观音冲泡水温 95 度，注水后 45 秒出汤。"), facts);
        assertThat(score.relevance()).isEqualTo(5);
    }

    @Test
    void relevanceLowWhenAnswerIsOffTopic() {
        QualityScore score = judge.judge(
                input("铁观音的冲泡水温是多少", "今天天气很好，推荐你去西湖走走。"), facts);
        assertThat(score.relevance()).isEqualTo(1);
    }

    @Test
    void relevanceNeutralWhenQuestionHasNoUsableKeywords() {
        // 问题为空时重合率无定义：给中性 3 分，不因「判不了」而扣分
        QualityScore score = judge.judge(input("", "西湖龙井用 80 度水温冲泡。"), facts);
        assertThat(score.relevance()).isEqualTo(3);
    }

    // -------------------------------------------------------- groundedness

    @Test
    void groundednessFullWhenTeaAndTempMatchCatalog() {
        QualityScore score = judge.judge(
                input("西湖龙井怎么泡", "西湖龙井用80℃水温冲泡，投茶3克。"), facts);
        assertThat(score.groundedness()).isEqualTo(5);
    }

    @Test
    void groundednessPenalizedForFabricatedTeaName() {
        // 「仙雾青峰茶」不在 teas 表：编造茶名扣 2 分
        QualityScore score = judge.judge(
                input("推荐一款茶", "这款仙雾青峰茶产自高山，香气清幽。"), facts);
        assertThat(score.groundedness()).isEqualTo(3);
    }

    @Test
    void groundednessPenalizedForOutOfRangeTemperature() {
        // 西湖龙井属绿茶（70-85℃），100℃ 越界扣 1 分
        QualityScore score = judge.judge(
                input("西湖龙井怎么泡", "西湖龙井要用100℃的沸水冲泡。"), facts);
        assertThat(score.groundedness()).isEqualTo(4);
    }

    @Test
    void groundednessPenalizedWhenNoRetrievalButConcreteParams() {
        // 这一轮 sources_count=0，却给出具体水温与时间：疑似模型自己编的参数，扣 1 分
        QualityScore score = judge.judge(
                new JudgeInput("铁观音怎么泡", "铁观音用95℃的水，45秒出汤。", false, "brewer"), facts);
        assertThat(score.groundedness()).isEqualTo(4);
    }

    @Test
    void knownTeaWithTeaSuffixIsNotFabricated() {
        // 「西湖龙井茶」包含库内茶名：长词形态不该被判成编造
        QualityScore score = judge.judge(
                input("西湖龙井怎么泡", "西湖龙井茶要低温冲泡。"), facts);
        assertThat(score.groundedness()).isEqualTo(5);
    }

    @Test
    void genericTeaWordsAreNotFabricatedNames() {
        // 「乌龙茶」是茶类泛称，不是编造的茶名
        QualityScore score = judge.judge(
                input("乌龙茶怎么泡", "乌龙茶要用沸水冲泡。"), facts);
        assertThat(score.groundedness()).isEqualTo(5);
    }

    @Test
    void measureWordOrParticleBeforeTeaIsNotAFabricatedName() {
        // 「买的茶」「煮一壶茶」都是通用说法：不能因为形如「XX茶」就判成编造
        QualityScore score = judge.judge(
                input("怎么选茶", "刚买的茶先醒一醒，煮一壶茶慢慢喝。"), facts);
        assertThat(score.groundedness()).isEqualTo(5);
    }

    @Test
    void emptyCatalogDoesNotPenalizeAnyTeaName() {
        // 茶表不可读时跳过「编造」判定：用空目录冤枉正确茶名比漏判更糟
        QualityScore score = judge.judge(
                input("推荐一款茶", "仙雾青峰茶产自高山。"), TeaFacts.empty());
        assertThat(score.groundedness()).isEqualTo(5);
    }

    // ------------------------------------------------------- actionability

    @Test
    void actionabilityFullWhenTempTimeAndAmountPresent() {
        QualityScore score = judge.judge(
                input("怎么泡", "水温95℃，冲泡45秒，投茶7克。"), facts);
        assertThat(score.actionability()).isEqualTo(5);
    }

    @Test
    void actionabilityPartialWhenTwoElementsPresent() {
        QualityScore score = judge.judge(
                input("怎么泡", "水温85℃，冲泡2分钟。"), facts);
        assertThat(score.actionability()).isEqualTo(4);
    }

    @Test
    void actionabilityMinimalWhenNoExecutableParameter() {
        QualityScore score = judge.judge(
                input("怎么泡", "静心感受茶汤的层次。"), facts);
        assertThat(score.actionability()).isEqualTo(1);
    }

    // ---------------------------------------------------------------- tone

    @Test
    void toneFullForQuietTeaRoomVoice() {
        QualityScore score = judge.judge(
                input("怎么泡", "先温杯烫盏，再注水出汤，静候片刻。"), facts);
        assertThat(score.tone()).isEqualTo(5);
    }

    @Test
    void toneMinimalForCustomerServiceCliche() {
        QualityScore score = judge.judge(
                input("怎么泡", "亲，很高兴为您服务！如有疑问请随时联系客服哦。"), facts);
        assertThat(score.tone()).isEqualTo(1);
    }

    // ------------------------------------------------------------- 边界

    @Test
    void emptyAnswerScoresOneOnEveryDimension() {
        QualityScore score = judge.judge(input("西湖龙井怎么泡", ""), facts);
        assertThat(score.relevance()).isEqualTo(1);
        assertThat(score.groundedness()).isEqualTo(1);
        assertThat(score.actionability()).isEqualTo(1);
        assertThat(score.tone()).isEqualTo(1);
        assertThat(score.overall()).isEqualTo(1.0);
        assertThat(score.judgeVersion()).isEqualTo(RuleBasedJudge.VERSION);
    }

    @Test
    void overlongAnswerIsAnalyzedWithoutBlowingUp() {
        String chunk = "西湖龙井用80℃水温冲泡，投茶3克，静待60秒。";
        String answer = chunk.repeat(200); // ≈ 4400 字，超过 2000 字分析上限
        QualityScore score = judge.judge(input("西湖龙井怎么泡", answer), facts);
        assertThat(score.relevance()).isBetween(1, 5);
        assertThat(score.actionability()).isEqualTo(5);
        assertThat(score.tone()).isEqualTo(5);
        assertThat(score.overall()).isBetween(1.0, 5.0);
    }

    @Test
    void overallIsTheAverageOfFourDimensions() {
        // (5+4+3+2)/4 = 3.5
        QualityScore score = new QualityScore(5, 4, 3, 2, "manual");
        assertThat(score.overall()).isEqualTo(3.5);
        // 越界分被钳到 1-5：LLM 返回 0/9 时不能污染均值
        assertThat(new QualityScore(0, 9, 5, -3, null).relevance()).isEqualTo(1);
        assertThat(new QualityScore(0, 9, 5, -3, null).groundedness()).isEqualTo(5);
        assertThat(new QualityScore(0, 9, 5, -3, null).judgeVersion()).isEqualTo("unknown");
    }
}
