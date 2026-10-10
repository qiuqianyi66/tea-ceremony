package com.tea.ai.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tea.ai.agent.AdvisorAgent;
import com.tea.ai.agent.AgentOrchestrator;
import com.tea.ai.agent.BrewerAgent;
import com.tea.ai.agent.LibrarianAgent;
import com.tea.ai.agent.MentorAgent;
import com.tea.ai.agent.TasterAgent;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.common.exception.QuotaExceededException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

/**
 * F-6 会话配额专项测试（ADR-018 保留的唯一低成本件）。
 * 覆盖：边界（第 N 次通过 / 第 N+1 次抛）、游客不计数、配置关闭、隔离性、超限不调 LLM。
 */
class AiCallQuotaTest {

    // ---- 纯配额组件行为 ----

    @Test
    void 第N次放行第N加1次拒绝() {
        AiCallQuota quota = new AiCallQuota(3);
        assertTrue(quota.tryAcquire(1), "第 1 次应放行");
        assertTrue(quota.tryAcquire(1), "第 2 次应放行");
        assertTrue(quota.tryAcquire(1), "第 3 次应放行");
        assertFalse(quota.tryAcquire(1), "第 4 次应拒绝");
    }

    @Test
    void 游客sessionId为null不计数且始终放行() {
        AiCallQuota quota = new AiCallQuota(1);
        for (int i = 0; i < 10; i++) {
            assertTrue(quota.tryAcquire(null), "游客第 " + (i + 1) + " 次应放行");
        }
    }

    @Test
    void 配置小于等于0视为不限() {
        AiCallQuota quota = new AiCallQuota(0);
        for (int i = 0; i < 100; i++) {
            assertTrue(quota.tryAcquire(9), "不限时第 " + (i + 1) + " 次应放行");
        }
    }

    @Test
    void 不同会话计数相互隔离() {
        AiCallQuota quota = new AiCallQuota(2);
        quota.tryAcquire(1);
        quota.tryAcquire(1);
        assertFalse(quota.tryAcquire(1), "会话 1 已达上限");
        assertTrue(quota.tryAcquire(2), "会话 2 应独立计数，不受会话 1 影响");
    }

    // ---- 与 AiChatService 集成：超限不调 LLM ----

    @Test
    void 超限时抛QuotaExceeded且不派发任何专家() {
        AiCallQuota quota = new AiCallQuota(1);
        AiChatService service = serviceWith(quota, "test-key");

        // 预消费掉唯一配额（走配额组件本身，避免牵扯 LLM mock 链路）
        assertTrue(quota.tryAcquire(1), "预消费第 1 次应放行");

        // 配额已用尽 → 429（与 502 上游不可用语义区分；前端 teaAI.ts 对非 2xx 均规则降级）
        QuotaExceededException ex = assertThrows(QuotaExceededException.class,
                () -> service.chat(1, req(1)));
        assertTrue(ex.getMessage().contains("上限"), "错误信息应含「上限」，实际：" + ex.getMessage());
        verify(librarian, never()).chat(any(), any());
        verify(advisor, never()).chat(any(), any());
    }

    // ---- 夹具 ----

    private final ChatClient.Builder builder = mock(ChatClient.Builder.class);
    private final AgentOrchestrator orchestrator = mock(AgentOrchestrator.class);
    private final LibrarianAgent librarian = mock(LibrarianAgent.class);
    private final AdvisorAgent advisor = mock(AdvisorAgent.class);
    private final TasterAgent taster = mock(TasterAgent.class);
    private final BrewerAgent brewer = mock(BrewerAgent.class);
    private final MentorAgent mentor = mock(MentorAgent.class);
    private final AiUsageLogger usageLogger = mock(AiUsageLogger.class);
    private final ChatMemoryService memoryService = mock(ChatMemoryService.class);
    private final TraceRecorder traceRecorder = mock(TraceRecorder.class);

    private AiChatService serviceWith(AiCallQuota quota, String apiKey) {
        when(builder.build()).thenReturn(mock(ChatClient.class));
        return new AiChatService(builder, usageLogger, orchestrator, memoryService, traceRecorder,
                librarian, advisor, taster, brewer, mentor, quota, apiKey);
    }

    private static AiChatRequest req(Integer sessionId) {
        return new AiChatRequest(List.of(new ChatMessageDto("user", "你好")), null, sessionId);
    }
}
