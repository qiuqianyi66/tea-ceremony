package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiUsageLogger;
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
 * 荐茶师专家（M5-S2 注册，F-1，需求 ai-agents-prd.md）。
 * 差异化人设（用户点名）：茶席边的懂茶朋友——温婉亲切，先理解口味/场景再推荐，输出「推荐茶单」（2~3 款候选 + 理由）。
 * 数据源：CultureSearchService RAG 检索（teas/regions/processes）。
 * 承重墙不变（继承 BaseExpertAgent）：key 缺失/上游失败 → 502；成功调用落计量（agent=advisor）。
 */
@Component
public class AdvisorAgent extends BaseExpertAgent {

    /** 荐茶师系统提示（差异化语气；版本化前内置常量，S2 agent_prompts 表替换） */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的荐茶师（advisor），一位温婉的懂茶朋友，不是销售。
            语气：亲切自然，像茶席边的对谈；先理解对方的口味、场景与时令，再给推荐。
            输出形态：「推荐茶单」——2~3 款候选，每款一句理由（贴合口味/时令/场景），可附产区。
            规则：
            1. 优先依据下方「知识库检索结果」选茶，标注茶名与产区出处。
            2. 知识库未命中时用通用茶知识作答，明确说明"知识库未命中，以下为常识回答"。
            3. 不编造茶名/产区；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            """;

    private final CultureSearchService cultureSearchService;

    public AdvisorAgent(ChatClient.Builder chatClientBuilder,
                        CultureSearchService cultureSearchService,
                        AiUsageLogger usageLogger,
                        @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        super(chatClientBuilder, usageLogger, apiKey);
        this.cultureSearchService = cultureSearchService;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        checkKey();
        String question = lastUserMessage(req);
        CultureSearchResult hit = cultureSearchService.search(question);
        long start = System.currentTimeMillis();
        ChatResponse response = callLlm(SYSTEM_PROMPT + "\n\n【知识库检索结果】\n" + renderContext(hit), question);
        return toVo(userId, req, response, collectSources(hit), start);
    }

    private String renderContext(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder();
        if (!hit.teas().isEmpty()) {
            sb.append("茶：").append(String.join("、", hit.teas().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.regions().isEmpty()) {
            sb.append("产区：").append(String.join("、", hit.regions().stream().map(r -> r.name()).toList())).append("\n");
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
        hit.regions().forEach(r -> sources.add("产区·" + r.name()));
        hit.processes().forEach(p -> sources.add("工艺·" + p.name()));
        return sources;
    }
}
