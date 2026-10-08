package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;

/**
 * 专家基类（M5-S2 四专家共享）：key 门禁 / 取用户消息 / LLM 调用（502 兜底）/ 计量旁路 / prompt 版本化。
 * 子类职责：SYSTEM_PROMPT + 检索/记录加载 + 上下文渲染 + 来源标注 + chat() 组装。
 * 承重墙不变：key 缺失/上游失败 → 502；成功调用落计量；计量失败不影响响应。
 * prompt 版本化（agent_prompts 表）：systemPrompt(agent, fallback) 读 active 版本，无则回退内置常量。
 */
@Slf4j
public abstract class BaseExpertAgent {

    protected final ChatClient chatClient;
    protected final AiUsageLogger usageLogger;
    protected final PromptService promptService;
    private final String apiKey;

    protected BaseExpertAgent(ChatClient.Builder chatClientBuilder,
                              AiUsageLogger usageLogger,
                              PromptService promptService,
                              String apiKey) {
        this.chatClient = chatClientBuilder.build();
        this.usageLogger = usageLogger;
        this.promptService = promptService;
        this.apiKey = apiKey;
    }

    /** key 门禁：缺失/占位 disabled → 502（前端 teaAI.ts 据此降级规则引擎）。 */
    protected void checkKey() {
        if (apiKey == null || apiKey.isBlank() || "disabled".equals(apiKey)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }
    }

    /** 取最后一条用户消息（截断 500 字，防超长输入）。 */
    protected String lastUserMessage(AiChatRequest req) {
        for (int i = req.messages().size() - 1; i >= 0; i--) {
            ChatMessageDto m = req.messages().get(i);
            if ("user".equals(m.role())) {
                String c = m.content();
                return c.length() > 500 ? c.substring(0, 500) : c;
            }
        }
        return "";
    }

    /** prompt 版本化：agent 的 active 版本；无 active 版本 → 内置常量回退（版本化前行为不变）。 */
    protected String systemPrompt(String agent, String fallback) {
        return promptService.getPrompt(agent, fallback);
    }

    /** LLM 调用（异常转 502，不向上抛原始堆栈）。 */
    protected ChatResponse callLlm(String system, String question) {
        long start = System.currentTimeMillis();
        try {
            return chatClient.prompt()
                    .system(system)
                    .user(question)
                    .call().chatResponse();
        } catch (Exception e) {
            log.warn("{} LLM call failed: {}", getClass().getSimpleName(), e.getMessage());
            throw new BadGatewayException("AI 服务调用失败");
        }
    }

    /** 提取正文（空 → 502），并落计量（旁路：失败不影响响应）。latency 由调用处 start 计时。 */
    protected AiChatVo toVo(Integer userId, AiChatRequest req, ChatResponse response, List<String> sources, long startMillis) {
        String content = response.getResult().getOutput().getText();
        if (content == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }
        int latency = (int) (System.currentTimeMillis() - startMillis);
        try {
            usageLogger.save(userId, req, response, latency);
        } catch (Exception e) {
            log.warn("save usage log failed: {}", e.getMessage());
        }
        return new AiChatVo(content, sources);
    }
}
