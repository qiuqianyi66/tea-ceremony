package com.tea.ai.vo;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.Map;

/**
 * AI 聊天响应（M5-S1 契约：content + sources；M5-S2 加 sessionId；T07 加评测旁路 tokens/latency）。
 * sources：知识来源（茶/人/产区/诗名）；透明代理/未命中时为 null（前端兼容：无引用卡片）。
 * sessionId：登录用户会话记忆返回；游客/续写失败时为 null（前端兼容：无记忆）。
 * tokensIn/tokensOut/latencyMs：评测旁路（T07 Trace 用；null 时前端不感知，jackson non_null）。
 * degraded：true = 本次答复来自本地规则库（上游 AI 不可用时的第二级兜底），不是模型生成。
 *            前端据此可加「规则回答」标记；null/false 时字段不出现，旧客户端无感。
 * ragTrace：文化检索观测（A8 归因用，2026-11-04）。装本次 culture_query 的调用次数、模型传入的
 *            keyword、以及各表命中条数——「检索未命中」到底是模型没调、传错词、还是库里没有，
 *            三者只能靠它分开。**@JsonIgnore：不进 HTTP 响应**（对外契约零变化），只供 TraceRecorder
 *            写进 ai_eval_traces.exec_layer。
 */
public record AiChatVo(String content, List<String> sources, Integer sessionId,
                       Integer tokensIn, Integer tokensOut, Integer latencyMs, Boolean degraded,
                       @JsonIgnore Map<String, Object> ragTrace) {

    /** 兼容旧调用（无会话记忆）。 */
    public AiChatVo(String content, List<String> sources) {
        this(content, sources, null, null, null, null, null, null);
    }

    /** 兼容旧调用（有会话记忆）。 */
    public AiChatVo(String content, List<String> sources, Integer sessionId) {
        this(content, sources, sessionId, null, null, null, null, null);
    }

    /** 兼容旧调用（评测旁路 6 参形态，未标降级）。 */
    public AiChatVo(String content, List<String> sources, Integer sessionId,
                    Integer tokensIn, Integer tokensOut, Integer latencyMs) {
        this(content, sources, sessionId, tokensIn, tokensOut, latencyMs, null, null);
    }

    /** 7 参形态（带 degraded，无检索观测）。 */
    public AiChatVo(String content, List<String> sources, Integer sessionId,
                    Integer tokensIn, Integer tokensOut, Integer latencyMs, Boolean degraded) {
        this(content, sources, sessionId, tokensIn, tokensOut, latencyMs, degraded, null);
    }
}
