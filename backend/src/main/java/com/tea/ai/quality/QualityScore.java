package com.tea.ai.quality;

/**
 * 四维质量分（各 1-5）+ 总分（四维均值，2 位小数）。
 *
 * 为什么用 record 而不是 Map：评分器输出与聚合读侧共用同一形状，键名拼错编译期就报；
 * 落库时才转 JSONB（QualityJudgeService#toLayerJson），SQL 侧按键名取值。
 *
 * 紧凑构造器统一钳到 1-5：LLM 会返回 0、7、或字符串数字，越界分不该污染均值
 * （一条 0 分能把 20 条样本的均值拉低 0.25）。
 */
public record QualityScore(int relevance, int groundedness, int actionability, int tone, String judgeVersion) {

    public static final int MIN_SCORE = 1;
    public static final int MAX_SCORE = 5;

    public QualityScore {
        relevance = clamp(relevance);
        groundedness = clamp(groundedness);
        actionability = clamp(actionability);
        tone = clamp(tone);
        judgeVersion = judgeVersion == null || judgeVersion.isBlank() ? "unknown" : judgeVersion;
    }

    /** 总分 = 四维算术平均。为什么不用加权：四维在需求里权重相同，加权只会引入无法解释的系数。 */
    public double overall() {
        return round2((relevance + groundedness + actionability + tone) / 4.0);
    }

    static int clamp(int value) {
        return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
    }

    static double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
