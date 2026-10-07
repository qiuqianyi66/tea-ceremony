package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.response.PageResult;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import com.tea.record.service.TastingRecordService;
import com.tea.record.vo.RecordVo;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 成长导师专家（M5-S2 注册，F-4，需求 ai-agents-prd.md）。
 * 差异化人设（用户点名）：温和引路人——先肯定再建议，像陪练而非考官；输出「成长建议」（回顾轨迹 + 1~2 条下一步）。
 * 数据源：用户品鉴记录 + 茶文化常识（XP 成长体系后端未建，P1-8 前置；本切片按 PRD 确认用品鉴记录 + 常识引导）。
 * 承重墙不变（继承 BaseExpertAgent）：key 缺失/上游失败 → 502；成功调用落计量（agent=mentor）。
 */
@Slf4j
@Component
public class MentorAgent extends BaseExpertAgent {

    /** 成长导师系统提示（差异化语气；版本化前内置常量，S2 agent_prompts 表替换） */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的成长导师（mentor），一位温和的茶路引路人。
            语气：鼓励克制，先肯定再建议，像陪练而非考官；不评判、不施压。
            输出形态：「成长建议」——回顾最近品鉴轨迹（次数/口味偏好/记录习惯），给 1~2 条可落地的下一步尝试。
            规则：
            1. 优先基于下方「用户品鉴记录」给出可落地的建议；记录不足时引导开始记录，不凭空点评。
            2. 知识库（茶文化常识）作背景；未命中时明确说明"知识库未命中，以下为常识回答"。
            3. 不编造用户记录；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            """;

    private static final int RECENT_LIMIT = 10;

    private final TastingRecordService tastingRecordService;
    private final CultureSearchService cultureSearchService;

    public MentorAgent(ChatClient.Builder chatClientBuilder,
                       TastingRecordService tastingRecordService,
                       CultureSearchService cultureSearchService,
                       AiUsageLogger usageLogger,
                       @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        super(chatClientBuilder, usageLogger, apiKey);
        this.tastingRecordService = tastingRecordService;
        this.cultureSearchService = cultureSearchService;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        checkKey();
        String question = lastUserMessage(req);
        List<RecordVo> records = recentRecords(userId);
        CultureSearchResult hit = cultureSearchService.search(question);
        long start = System.currentTimeMillis();
        ChatResponse response = callLlm(SYSTEM_PROMPT + "\n\n" + renderContext(records, hit), question);
        return toVo(userId, req, response, collectSources(records, hit), start);
    }

    /** 取用户最近品鉴记录（未登录/无记录/加载失败 → 空列表）。 */
    private List<RecordVo> recentRecords(Integer userId) {
        if (userId == null) {
            return List.of();
        }
        try {
            PageResult<RecordVo> page = tastingRecordService.list(userId, 1, RECENT_LIMIT);
            return page.items() == null ? List.of() : page.items();
        } catch (Exception e) {
            log.warn("MentorAgent load records failed: {}", e.getMessage());
            return List.of();
        }
    }

    private String renderRecords(List<RecordVo> records) {
        if (records.isEmpty()) {
            return "（暂无品鉴记录）";
        }
        StringBuilder sb = new StringBuilder();
        for (RecordVo r : records) {
            sb.append("- ").append(r.tea_name() == null ? "未知茶" : r.tea_name());
            if (r.overall_score() != null) {
                sb.append("，总分 ").append(r.overall_score());
            }
            if (r.aroma_type() != null) {
                sb.append("，香气 ").append(r.aroma_type());
            }
            if (r.notes() != null && !r.notes().isBlank()) {
                sb.append("，备注 ").append(r.notes());
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String renderHit(CultureSearchResult hit) {
        StringBuilder sb = new StringBuilder();
        if (!hit.teas().isEmpty()) {
            sb.append("茶：").append(String.join("、", hit.teas().stream().map(t -> t.name()).toList())).append("\n");
        }
        if (!hit.people().isEmpty()) {
            sb.append("人：").append(String.join("、", hit.people().stream().map(p -> p.name()).toList())).append("\n");
        }
        if (!hit.regions().isEmpty()) {
            sb.append("产区：").append(String.join("、", hit.regions().stream().map(r -> r.name()).toList())).append("\n");
        }
        return sb.isEmpty() ? "（无命中）" : sb.toString();
    }

    private String renderContext(List<RecordVo> records, CultureSearchResult hit) {
        return "【用户品鉴记录】\n" + renderRecords(records) + "【知识库检索结果】\n" + renderHit(hit);
    }

    private List<String> collectSources(List<RecordVo> records, CultureSearchResult hit) {
        Set<String> sources = new LinkedHashSet<>();
        for (RecordVo r : records) {
            if (r.tea_name() != null && !r.tea_name().isBlank()) {
                sources.add("记录·" + r.tea_name());
            }
        }
        hit.teas().forEach(t -> sources.add("茶·" + t.name()));
        hit.regions().forEach(r -> sources.add("产区·" + r.name()));
        return new ArrayList<>(sources);
    }
}
