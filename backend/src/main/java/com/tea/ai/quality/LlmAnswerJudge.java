package com.tea.ai.quality;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.BaseExpertAgent;
import com.tea.ai.resilience.AiCallExecutor;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * LLM-as-a-Judge 评分器（优先路径）。
 *
 * 为什么复用专家的 ChatClient/AiCallExecutor 而不是自己发 HTTP：
 * 同一套 key 解析（AI_KEY_EXPR，随 spring.ai.model.chat 切 dashscope/openai 网关）与同一套
 * 超时/重试/熔断（lane=judge，独立熔断桶）——评分链路上游抖动时不会连带熔断用户对话的 lane。
 *
 * 失败语义：任何不可用（未配 key、熔断、超时、返回非 JSON）都返回 Optional.empty()，
 * 由 QualityJudgeService 降级到 RuleBasedJudge。这里不抛异常：评分是旁路，不能把定时任务打挂。
 *
 * 为什么回答截断到 1500 字：评分只看「答得好不好」的形态，超长回答只会白烧 token。
 */
@Slf4j
@Component
public class LlmAnswerJudge implements AnswerJudge {

    public static final String VERSION = "llm-v1";
    static final String LANE = "judge";
    static final int MAX_ANSWER_CHARS = 1500;
    static final int MAX_QUESTION_CHARS = 500;

    private static final List<String> DIMENSIONS =
            List.of("relevance", "groundedness", "actionability", "tone");

    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的回答质量评分员。对给定的「用户问题」与「AI 回答」按四个维度各打 1-5 分：
            relevance 相关性：回答是否切题，有没有答非所问；
            groundedness 有据性：是否只用了给定的茶知识，有没有编造茶名、产区或冲泡参数（编造即低分）；
            actionability 可操作性：是否给出可执行的水温、时间、投茶量；
            tone 语气：是否沉静克制的茶室语气，而不是客服腔（"亲""很高兴为您服务"这类即低分）。
            只输出一个 JSON 对象，不要解释、不要代码块：
            {"relevance":n,"groundedness":n,"actionability":n,"tone":n}
            """;

    private final ChatClient chatClient;
    private final AiCallExecutor aiCallExecutor;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public LlmAnswerJudge(ChatClient.Builder chatClientBuilder,
                          AiCallExecutor aiCallExecutor,
                          ObjectMapper objectMapper,
                          @Value(BaseExpertAgent.AI_KEY_EXPR) String apiKey) {
        this.chatClient = chatClientBuilder.build();
        this.aiCallExecutor = aiCallExecutor;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    @Override
    public Optional<QualityScore> judge(JudgeInput input) {
        if (!keyAvailable()) {
            // 未配 key 是默认状态（application.yml 里 api-key: disabled）：直接降级，不打日志刷屏
            return Optional.empty();
        }
        try {
            String raw = aiCallExecutor.execute(LANE, () -> chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt(input))
                    .call()
                    .content(), null);
            return parse(raw);
        } catch (RuntimeException e) {
            log.warn("LLM 质量评分不可用，降级规则评分: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public String version() {
        return VERSION;
    }

    boolean keyAvailable() {
        return apiKey != null && !apiKey.isBlank() && !"disabled".equals(apiKey);
    }

    private static String userPrompt(JudgeInput input) {
        return "【用户问题】\n" + truncate(input.question(), MAX_QUESTION_CHARS)
                + "\n\n【本轮是否检索到茶数据】" + (input.hasRetrieval() ? "是" : "否")
                + "\n\n【AI 回答】\n" + truncate(input.answer(), MAX_ANSWER_CHARS);
    }

    /** 解析模型输出：容许代码块围栏与前后废话，缺维度或非 JSON 一律视为不可用（降级）。 */
    Optional<QualityScore> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("LLM 评分输出无 JSON，降级规则评分");
            return Optional.empty();
        }
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            for (String dimension : DIMENSIONS) {
                if (!node.hasNonNull(dimension) || !node.get(dimension).canConvertToInt()) {
                    log.warn("LLM 评分缺维度 {}，降级规则评分", dimension);
                    return Optional.empty();
                }
            }
            return Optional.of(new QualityScore(
                    node.get("relevance").asInt(),
                    node.get("groundedness").asInt(),
                    node.get("actionability").asInt(),
                    node.get("tone").asInt(),
                    VERSION));
        } catch (Exception e) {
            log.warn("LLM 评分输出解析失败，降级规则评分: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }
}
