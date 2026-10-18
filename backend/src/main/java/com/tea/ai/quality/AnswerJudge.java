package com.tea.ai.quality;

import java.util.Optional;

/**
 * 评分器抽象：LLM 版是 {@link LlmAnswerJudge}，规则版是 {@link RuleBasedJudge}
 * （规则版不实现本接口——它需要 {@link TeaFacts} 入参，签名不同，硬套接口只会多一层包装）。
 *
 * 为什么 judge 返回 Optional 而不是抛异常/返回 null：
 * 「LLM 不可用」是常态（没配 key、熔断、上游 502），调用方要的语义是「这次判不了，去降级」，
 * 而不是「出错了」——返回 Optional.empty() 让降级分支无需 try/catch 就能表达。
 */
public interface AnswerJudge {

    /** 给出四维分；不可用时返回 empty（调用方据此降级到规则版）。 */
    Optional<QualityScore> judge(JudgeInput input);

    /** 评分器版本（写入 quality_layer.judge_version，换版后凭它筛出待重算的行）。 */
    String version();
}
