package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.service.AgentSkillRouter;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 茶文化学者专家（M5-S1 试点，F-S1-3）。
 * 流程：取最后一条用户消息 → CultureSearchService RAG 检索 → 专家 prompt（含知识库上下文）→ LLM 生成 → 回复附知识来源。
 * 承重墙不变：key 缺失/上游失败 → 502（前端 teaAI.ts 降级）；成功调用落计量（agent=librarian）。
 * 内置 prompt 常量；agent_prompts 表版本化（S2）后替换为读取表。
 */
@Slf4j
@Component
public class LibrarianAgent {

    /** 专家系统提示（版本化前的内置常量） */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的茶文化学者（librarian），精通中国茶史、茶器、茶诗与产区文化。
            回答规则：
            1. 优先依据下方「知识库检索结果」作答，并标注出处（茶名/人名/产区/诗名）。
            2. 知识库未命中时，用通用茶文化常识作答，并明确说明"知识库未命中，以下为常识回答"。
            3. 不编造具体茶名、茶器、历史人物；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            """;

    private final ChatClient chatClient;
    private final CultureSearchService cultureSearchService;
    private final AiUsageLogger usageLogger;
    private final PromptService promptService;
    private final AgentSkillRouter skillRouter;
    private final String apiKey;

    public LibrarianAgent(ChatClient.Builder chatClientBuilder,
                          CultureSearchService cultureSearchService,
                          AiUsageLogger usageLogger,
                          PromptService promptService,
                          AgentSkillRouter skillRouter,
                          @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        this.chatClient = chatClientBuilder.build();
        this.cultureSearchService = cultureSearchService;
        this.usageLogger = usageLogger;
        this.promptService = promptService;
        this.skillRouter = skillRouter;
        this.apiKey = apiKey;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        if (apiKey == null || apiKey.isBlank() || "disabled".equals(apiKey)) {
            throw new BadGatewayException("AI 服务未配置（缺少 API key）");
        }

        String question = lastUserMessage(req);
        CultureSearchResult hit = cultureSearchService.search(question);
        String context = renderContext(hit);
        List<String> sources = collectSources(hit);

        // T08 运行时技能（ADR-017）：按领域关键词命中 → 注入子指令；未命中不膨胀上下文
        String domain = skillRouter.detect(question);
        String skill = domain == null ? "" : skillRouter.load("librarian", domain);
        String system = promptService.getPrompt("librarian", SYSTEM_PROMPT);
        if (!skill.isBlank()) {
            system += "\n\n【领域技能·" + domain + "】\n" + skill;
        }
        system += "\n\n【知识库检索结果】\n" + context;

        long start = System.currentTimeMillis();
        ChatResponse response;
        try {
            response = chatClient.prompt()
                    .system(system)
                    .user(question)
                    .call().chatResponse();
        } catch (Exception e) {
            log.warn("LibrarianAgent LLM call failed: {}", e.getMessage());
            throw new BadGatewayException("AI 服务调用失败");
        }
        int latency = (int) (System.currentTimeMillis() - start);

        String content = response.getResult().getOutput().getText();
        if (content == null) {
            throw new BadGatewayException("AI 服务返回为空");
        }

        try {
            usageLogger.save(userId, req, response, latency);
        } catch (Exception e) {
            log.warn("save usage log failed: {}", e.getMessage());
        }
        return new AiChatVo(content, sources);
    }

    private String lastUserMessage(AiChatRequest req) {
        for (int i = req.messages().size() - 1; i >= 0; i--) {
            ChatMessageDto m = req.messages().get(i);
            if ("user".equals(m.role())) {
                String c = m.content();
                return c.length() > 500 ? c.substring(0, 500) : c;
            }
        }
        return "";
    }

    private String renderContext(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder();
        if (!hit.teas().isEmpty()) {
            sb.append("茶：").append(String.join("、", hit.teas().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.people().isEmpty()) {
            sb.append("人：").append(String.join("、", hit.people().stream().map(p -> p.name() + (p.dynasty() == null ? "" : "（" + p.dynasty() + "）")).toList())).append("\n");
        }
        if (!hit.regions().isEmpty()) {
            sb.append("产区：").append(String.join("、", hit.regions().stream().map(r -> r.name()).toList())).append("\n");
        }
        if (!hit.poems().isEmpty()) {
            sb.append("诗：").append(String.join("、", hit.poems().stream().map(p -> p.title() + "（" + p.author() + "）").toList())).append("\n");
        }
        if (!hit.teawares().isEmpty()) {
            sb.append("茶器：").append(String.join("、", hit.teawares().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.etiquettes().isEmpty()) {
            sb.append("茶礼：").append(String.join("、", hit.etiquettes().stream().map(e -> e.name()).toList())).append("\n");
        }
        if (!hit.relations().isEmpty()) {
            sb.append("关系：").append(String.join("、", hit.relations().stream()
                    .map(r -> r.relation() + "（" + r.source() + "→" + r.target() + "）").toList())).append("\n");
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
        hit.people().forEach(p -> sources.add("人·" + p.name()));
        hit.regions().forEach(r -> sources.add("产区·" + r.name()));
        hit.poems().forEach(p -> sources.add("诗·" + p.title()));
        hit.teawares().forEach(t -> sources.add("茶器·" + t.name()));
        hit.etiquettes().forEach(e -> sources.add("茶礼·" + e.name()));
        hit.relations().forEach(r -> sources.add("关系·" + r.relation()));
        hit.processes().forEach(p -> sources.add("工艺·" + p.name()));
        return sources;
    }
}
