package com.tea.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.BaseExpertAgent;
import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.UserMemory;
import com.tea.ai.repository.AiChatMessageRepository;
import com.tea.ai.resilience.AiCallExecutor;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 会话结束画像抽取（F-B2 / ADR-028）：把一个已结束会话的对话交给 LLM，提炼
 * preference / restriction / habit 三类一句话摘要，合并 upsert 回 user_memory。
 *
 * <p>失败语义：best-effort 旁路——未配 key、熔断、超时、输出非 JSON 一律 warn 后跳过，
 * 绝不抛给聊天承重墙（与 persist/计量旁路同语义）。</p>
 *
 * <p>隐私红线写进 prompt：不记录姓名/电话/账号等敏感信息；本类只传对话正文摘要，
 * 不接触用户表其它字段。</p>
 */
@Slf4j
@Component
public class UserMemoryExtractor {

    static final String LANE = "memory";
    static final int MAX_TRANSCRIPT_CHARS = 4000;

    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的茶客画像整理员。阅读一段茶客与茶灵的对话，提炼这位茶客稳定、长期有效的偏好信息。
            只输出一个 JSON 对象，不要解释、不要代码块：
            {"preference":"偏好茶类/口味，没有则空字符串","restriction":"忌口/禁忌，没有则空字符串","habit":"常用茶器/冲泡习惯，没有则空字符串"}
            纪律：
            1. 用一句话提炼，每类不超过 50 字；不要照抄原话；
            2. 只记跨会话稳定的信息，单次场景寒暄不记；
            3. 绝对不要记录姓名、电话、账号、地址等敏感个人信息；
            4. 如果给了「已有摘要」，把已有摘要与本会话新信息合并成更新后的一句话（矛盾以最新说法为准），
               不要简单追加重复内容；没有新信息的类别照抄已有摘要。
            """;

    private final ChatClient chatClient;
    private final AiCallExecutor aiCallExecutor;
    private final AiChatMessageRepository messageRepository;
    private final UserMemoryService userMemoryService;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public UserMemoryExtractor(ChatClient.Builder chatClientBuilder,
                               AiCallExecutor aiCallExecutor,
                               AiChatMessageRepository messageRepository,
                               UserMemoryService userMemoryService,
                               ObjectMapper objectMapper,
                               @Value(BaseExpertAgent.AI_KEY_EXPR) String apiKey) {
        this.chatClient = chatClientBuilder.build();
        this.aiCallExecutor = aiCallExecutor;
        this.messageRepository = messageRepository;
        this.userMemoryService = userMemoryService;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    /**
     * 抽取一个会话并合并写回画像。任何失败仅 warn，不抛异常。
     *
     * @return 真正写回更新的类别数（0 = 会话太短/未配 key/上游不可用/无新信息）
     */
    public int extractFromSession(Integer userId, Integer sessionId) {
        if (userId == null || sessionId == null) {
            return 0;
        }
        if (apiKey == null || apiKey.isBlank() || "disabled".equals(apiKey)) {
            return 0;
        }
        try {
            List<AiChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
            if (messages.size() < 2) {
                return 0;
            }
            String transcript = transcript(messages);
            if (transcript.isBlank()) {
                return 0;
            }
            Map<String, String> existing = userMemoryService.existingSummaries(userId);
            String raw = aiCallExecutor.execute(LANE, () -> chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(userPrompt(existing, transcript))
                    .call()
                    .content(), null);
            return merge(userId, sessionId, raw);
        } catch (Exception e) {
            log.warn("extract user memory failed userId={} sessionId={}: {}", userId, sessionId, e.getMessage());
            return 0;
        }
    }

    /** 解析 LLM 输出并 upsert；空类别不动旧行（本会话没提 ≠ 偏好变了）。返回写回条数。 */
    int merge(Integer userId, Integer sessionId, String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("user memory extract output has no JSON, skip");
            return 0;
        }
        Map<String, String> candidates;
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            candidates = new LinkedHashMap<>();
            for (String key : List.of(UserMemory.KEY_PREFERENCE, UserMemory.KEY_RESTRICTION, UserMemory.KEY_HABIT)) {
                JsonNode v = node.get(key);
                if (v != null && !v.asText().isBlank()) {
                    candidates.put(key, v.asText().trim());
                }
            }
        } catch (Exception e) {
            log.warn("user memory extract output parse failed, skip: {}", e.getMessage());
            return 0;
        }
        int written = 0;
        for (Map.Entry<String, String> e : candidates.entrySet()) {
            userMemoryService.upsert(userId, e.getKey(), e.getValue(), sessionId);
            written++;
        }
        return written;
    }

    private static String transcript(List<AiChatMessage> messages) {
        StringBuilder sb = new StringBuilder();
        for (AiChatMessage m : messages) {
            if (m.getContent() == null || m.getContent().isBlank()) {
                continue;
            }
            String role = "user".equals(m.getRole()) ? "茶客" : "茶灵";
            sb.append(role).append("：").append(m.getContent()).append('\n');
        }
        String text = sb.toString();
        return text.length() > MAX_TRANSCRIPT_CHARS ? text.substring(0, MAX_TRANSCRIPT_CHARS) : text;
    }

    private static String userPrompt(Map<String, String> existing, String transcript) {
        StringBuilder sb = new StringBuilder();
        sb.append("【已有画像摘要】");
        if (existing.isEmpty()) {
            sb.append("（无）");
        } else {
            existing.forEach((k, v) -> sb.append('\n').append(k).append("：").append(v));
        }
        sb.append("\n\n【对话记录】\n").append(transcript);
        return sb.toString();
    }
}
