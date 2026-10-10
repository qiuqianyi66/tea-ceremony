package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.vo.AiChatVo;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 冲泡师专家（M5-S2 注册，F-3，需求 ai-agents-prd.md）。
 * 差异化人设（用户点名）：重实操的功夫茶冲泡师——直接利落，给可执行参数（水温℃/投茶量/器型/注水/出汤）；输出「冲泡方案」。
 * 数据源：CultureSearchService RAG 检索（teas/teawares/processes）。
 * 承重墙不变（继承 BaseExpertAgent）：key 缺失/上游失败 → 502；成功调用落计量（agent=brewer）。
 */
@Component
public class BrewerAgent extends BaseExpertAgent {

    /** 冲泡师系统提示（差异化语气；版本化前内置常量，S2 agent_prompts 表替换） */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的冲泡师（brewer），一位重实操的功夫茶冲泡师。
            语气：直接利落，给具体可执行参数（水温℃、投茶量、器型、注水方式、出汤秒），不绕弯。
            输出形态：「冲泡方案」——按步骤列出关键参数与操作要点，可直接照做。
            规则：
            1. 优先依据下方「知识库检索结果」（工艺/茶器）给参数，标注出处。
            2. 知识库未命中时用通用冲泡常识作答，明确说明"知识库未命中，以下为常识回答"。
            3. 不编造参数来源；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            5. 涉功效（减肥/治病/养生）须说明茶是饮品而非药物、需配合饮食运动；禁引经据典暗示疗效。涉咖啡因须提示影响并给低因替代。
            """;

    private final CultureSearchService cultureSearchService;

    public BrewerAgent(ChatClient.Builder chatClientBuilder,
                       CultureSearchService cultureSearchService,
                       AiUsageLogger usageLogger,
                       PromptService promptService,
                       @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        super(chatClientBuilder, usageLogger, promptService, apiKey);
        this.cultureSearchService = cultureSearchService;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        checkKey();
        String question = lastUserMessage(req);
        CultureSearchResult hit = cultureSearchService.search(question);
        long start = System.currentTimeMillis();
        ChatResponse response = callLlm(systemPrompt("brewer", SYSTEM_PROMPT) + "\n\n【知识库检索结果】\n" + renderContext(hit), question);
        return toVo(userId, req, response, collectSources(hit), start);
    }

    private String renderContext(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder();
        if (!hit.teas().isEmpty()) {
            sb.append("茶：").append(String.join("、", hit.teas().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.teawares().isEmpty()) {
            sb.append("茶器：").append(String.join("、", hit.teawares().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.processes().isEmpty()) {
            sb.append("工艺：").append(String.join("、", hit.processes().stream()
                    .map(p -> p.name() + (p.teaCategory() == null ? "" : "（" + p.teaCategory() + "）")).toList())).append("\n");
        }
        return sb.isEmpty() ? "（无命中）" : sb.toString();
    }

    private List<String> collectSources(CultureSearchResult hit) {
        List<String> sources = new ArrayList<>();
        hit.teas().forEach(t -> sources.add("茶·" + t.name()));
        hit.teawares().forEach(t -> sources.add("茶器·" + t.name()));
        hit.processes().forEach(p -> sources.add("工艺·" + p.name()));
        return sources;
    }
}
