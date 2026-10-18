package com.tea.ai.quality;

/**
 * 待评分的单条样本（评分器的唯一输入）。
 *
 * 为什么把 question / answer / hasRetrieval 抽成扁平 record 而不是直接传 AiEvalTrace：
 * 评分器（规则版与 LLM 版）不该依赖 JPA 实体——纯函数才能单测、才能在不启动数据库的情况下回归；
 * trace 的 JSONB 解析留在 QualityJudgeService（那里已经有 ObjectMapper）。
 *
 * hasRetrieval：trace 的 exec_layer.sources_count > 0，即这一轮真的检索到了茶数据。
 * 规则版用它判「无检索依据却给出具体参数」，LLM 版把它写进提示词。
 */
public record JudgeInput(String question, String answer, boolean hasRetrieval, String agentType) {

    public JudgeInput {
        question = question == null ? "" : question;
        answer = answer == null ? "" : answer;
        agentType = agentType == null ? "" : agentType;
    }
}
