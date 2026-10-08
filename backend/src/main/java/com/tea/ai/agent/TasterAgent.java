package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiUsageLogger;
import com.tea.ai.service.PromptService;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.response.PageResult;
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
 * 品鉴师专家（M5-S2 注册，F-2，需求 ai-agents-prd.md）。
 * 差异化人设（用户点名）：写品鉴笔记的专业茶评人——沉稳细腻，注重感官描述；输出「品鉴点评」（结合用户记录逐维解读）。
 * 数据源：用户最近品鉴记录（最多 10 条；未登录/无记录 → 空，prompt 引导记录）。
 * 承重墙不变（继承 BaseExpertAgent）：key 缺失/上游失败 → 502；成功调用落计量（agent=taster）。
 */
@Slf4j
@Component
public class TasterAgent extends BaseExpertAgent {

    /** 品鉴师系统提示（差异化语气；版本化前内置常量，S2 agent_prompts 表替换） */
    static final String SYSTEM_PROMPT = """
            你是「一盏茶」的品鉴师（taster），一位写品鉴笔记的专业茶评人。
            语气：沉稳细腻，注重感官描述（干茶/香气/滋味/回甘/茶汤/叶底），像在写品鉴笔记。
            输出形态：「品鉴点评」——结合用户最近品鉴记录逐维解读，点出偏好与变化趋势。
            规则：
            1. 优先基于下方「用户品鉴记录」点评；无记录时先引导做一次品鉴记录，不凭空分析。
            2. 知识库（茶文化常识）作背景补充；未命中时明确说明"知识库未命中，以下为常识回答"。
            3. 不编造用户记录内容；不确定处标注"待核实"。
            4. 回答简洁（≤200 字），一次一个主题。
            """;

    private static final int RECENT_LIMIT = 10;

    private final TastingRecordService tastingRecordService;

    public TasterAgent(ChatClient.Builder chatClientBuilder,
                       TastingRecordService tastingRecordService,
                       AiUsageLogger usageLogger,
                       PromptService promptService,
                       @Value("${spring.ai.dashscope.api-key:}") String apiKey) {
        super(chatClientBuilder, usageLogger, promptService, apiKey);
        this.tastingRecordService = tastingRecordService;
    }

    public AiChatVo chat(Integer userId, AiChatRequest req) {
        checkKey();
        String question = lastUserMessage(req);
        List<RecordVo> records = recentRecords(userId);
        long start = System.currentTimeMillis();
        ChatResponse response = callLlm(systemPrompt("taster", SYSTEM_PROMPT) + "\n\n【用户品鉴记录】\n" + renderContext(records), question);
        return toVo(userId, req, response, collectSources(records), start);
    }

    /** 取用户最近品鉴记录（未登录/无记录/加载失败 → 空列表，prompt 引导记录）。 */
    private List<RecordVo> recentRecords(Integer userId) {
        if (userId == null) {
            return List.of();
        }
        try {
            PageResult<RecordVo> page = tastingRecordService.list(userId, 1, RECENT_LIMIT);
            return page.items() == null ? List.of() : page.items();
        } catch (Exception e) {
            log.warn("TasterAgent load records failed: {}", e.getMessage());
            return List.of();
        }
    }

    private String renderContext(List<RecordVo> records) {
        if (records.isEmpty()) {
            return "（暂无品鉴记录）";
        }
        StringBuilder sb = new StringBuilder();
        for (RecordVo r : records) {
            sb.append("- ").append(r.tea_name() == null ? "未知茶" : r.tea_name());
            if (r.aroma_type() != null) {
                sb.append("，香气 ").append(r.aroma_type());
            }
            if (r.overall_score() != null) {
                sb.append("，总分 ").append(r.overall_score());
            }
            if (r.dimensions() != null && !r.dimensions().isEmpty()) {
                sb.append("，维度 ").append(r.dimensions());
            }
            if (r.notes() != null && !r.notes().isBlank()) {
                sb.append("，备注 ").append(r.notes());
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private List<String> collectSources(List<RecordVo> records) {
        Set<String> sources = new LinkedHashSet<>();
        for (RecordVo r : records) {
            if (r.tea_name() != null && !r.tea_name().isBlank()) {
                sources.add("记录·" + r.tea_name());
            }
        }
        return new ArrayList<>(sources);
    }
}
