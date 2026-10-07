package com.tea.ai.agent;

/**
 * 茶灵专家类型（M5-S1 契约枚举；S1 仅 LIBRARIAN 生效，其余枚举预留 S2）。
 * 未知 agent 值在编排层校验 → 400 PARAM_INVALID。
 */
public enum AgentType {
    /** 透明代理（缺省） */
    CHAT("chat"),
    /** 荐茶师 */
    ADVISOR("advisor"),
    /** 品鉴师 */
    TASTER("taster"),
    /** 茶文化学者（S1 试点） */
    LIBRARIAN("librarian"),
    /** 冲泡师 */
    BREWER("brewer"),
    /** 成长导师 */
    MENTOR("mentor");

    private final String code;

    AgentType(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    /** 解析 agent 字符串；未知/空返回 null（空由编排层按缺省处理）。 */
    public static AgentType fromCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        for (AgentType t : values()) {
            if (t.code.equals(code)) {
                return t;
            }
        }
        return null;
    }
}
