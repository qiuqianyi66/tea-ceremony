package com.tea.ai.agent;

import com.tea.ai.dto.AiChatRequest;
import com.tea.common.exception.BadRequestException;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Agent 编排器（M5-S1 路由骨架；S2 五专家扩容）。
 * 路由规则（F-S1-2 / F-5）：
 * 1. 显式 agent 参数 → 校验枚举（未知 → 400 PARAM_INVALID）；合法枚举 → 对应专家（CHAT → 透明代理）；
 * 2. 无 agent → 文化意图关键词粗分命中 LIBRARIAN；
 * 3. 其余 → 回落透明代理（T11 行为不变，承重墙保留）。
 * S3 引入 Graph 工作流。
 */
@Component
public class AgentOrchestrator {

    /** 文化知识意图关键词（粗分；命中即路由 librarian） */
    static final List<String> CULTURE_KEYWORDS = List.of(
            "茶", "茶器", "茶具", "历史", "文化", "知识", "茶圣", "陆羽", "茶经",
            "茶诗", "诗词", "产区", "山场", "茶人", "典故", "古法", "茶道");

    /**
     * 判定请求路由到的专家类型（F-5）。
     * 返回 null = 透明代理；返回 CHAT = 显式要求透明代理；其余 = 对应专家。
     */
    public AgentType routeToAgent(AiChatRequest req) {
        AgentType type = AgentType.fromCode(req.agent());
        if (type != null) {
            return type;
        }
        if (req.agent() != null && !req.agent().isBlank()) {
            // 显式给了未知 agent：S1 契约收紧 → 400（透明代理期自由字符串不再接受）
            throw new BadRequestException("未知 agent 类型: " + req.agent());
        }
        return hasCultureIntent(req) ? AgentType.LIBRARIAN : null;
    }

    /** S1 兼容：是否路由到 librarian 专家（委托 routeToAgent）。 */
    public boolean routeToLibrarian(AiChatRequest req) {
        return routeToAgent(req) == AgentType.LIBRARIAN;
    }

    private boolean hasCultureIntent(AiChatRequest req) {
        if (req.messages() == null || req.messages().isEmpty()) {
            return false;
        }
        // 只看最后一条用户消息（用户最近意图），截取前 200 字符防超长
        String lastUser = "";
        for (var m : req.messages()) {
            if ("user".equals(m.role())) {
                lastUser = m.content();
            }
        }
        if (lastUser.isBlank()) {
            return false;
        }
        String sample = lastUser.length() > 200 ? lastUser.substring(0, 200) : lastUser;
        for (String kw : CULTURE_KEYWORDS) {
            if (sample.contains(kw)) {
                return true;
            }
        }
        return false;
    }
}
