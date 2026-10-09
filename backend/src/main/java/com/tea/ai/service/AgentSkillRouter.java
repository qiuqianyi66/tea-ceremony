package com.tea.ai.service;

import com.tea.ai.entity.AgentSkill;
import com.tea.ai.repository.AgentSkillRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 运行时领域技能路由（T08，ADR-017）：按问题关键词命中领域（茶器/茶诗/产区/茶人）。
 * 命中 → PromptService.loadSkill 取子指令注入；未命中 → null（上下文不膨胀）。
 * 关键词顺序固定（LinkedHashMap）：同词多领域时按声明序取首个命中。
 */
@Component
@RequiredArgsConstructor
public class AgentSkillRouter {

    private static final Map<String, List<String>> DOMAIN_KEYWORDS = new LinkedHashMap<>();
    static {
        DOMAIN_KEYWORDS.put("teaware", List.of("茶器", "紫砂", "盖碗", "茶壶", "公道杯", "建盏", "茶盏", "壶"));
        DOMAIN_KEYWORDS.put("poem", List.of("茶诗", "卢仝", "七碗茶", "煎茶七类", "诗"));
        DOMAIN_KEYWORDS.put("region", List.of("产区", "武夷", "安溪", "杭州", "龙井村", "凤凰", "勐海", "洞庭"));
        DOMAIN_KEYWORDS.put("person", List.of("茶人", "蔡襄", "宋徽宗", "赵佶", "神农", "陆羽"));
    }

    private final AgentSkillRepository skillRepository;

    /** 命中领域返回 domain；未命中返回 null。 */
    public String detect(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        for (Map.Entry<String, List<String>> entry : DOMAIN_KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (question.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    /** 取 active 技能文本；无 → 空串。 */
    public String load(String agent, String domain) {
        return skillRepository.findFirstByAgentAndDomainAndStatusOrderByUpdatedAtDesc(
                        agent, domain, "active")
                .map(AgentSkill::getSkill)
                .orElse("");
    }
}
