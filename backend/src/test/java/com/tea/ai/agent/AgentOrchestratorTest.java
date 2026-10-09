package com.tea.ai.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.common.exception.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.Test;

/** AgentOrchestrator 路由单测（F-S1-2 + F-5 + T09 复杂度）：显式 agent / 关键词粗分 / 未知 agent 400 / 回落透明代理 / 三档边界。 */
class AgentOrchestratorTest {

    private final AgentOrchestrator orchestrator = new AgentOrchestrator(40, 3, 200);

    private static AiChatRequest req(String agent, String... userMessages) {
        List<ChatMessageDto> msgs = java.util.Arrays.stream(userMessages)
                .map(c -> new ChatMessageDto("user", c))
                .toList();
        return new AiChatRequest(msgs, agent);
    }

    @Test
    void explicitLibrarianRoutesToLibrarian() {
        assertTrue(orchestrator.routeToLibrarian(req("librarian", "你好")));
    }

    @Test
    void cultureKeywordRoutesToLibrarian() {
        assertTrue(orchestrator.routeToLibrarian(req(null, "讲讲陆羽的茶经")));
    }

    @Test
    void nonCultureFallsBackToTransparent() {
        assertFalse(orchestrator.routeToLibrarian(req(null, "今天天气如何")));
    }

    @Test
    void unknownAgentRejects400() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orchestrator.routeToLibrarian(req("robot", "你好")));
        assertEquals("未知 agent 类型: robot", ex.getMessage());
    }

    @Test
    void emptyMessagesFallsBackToTransparent() {
        assertFalse(orchestrator.routeToLibrarian(new AiChatRequest(List.of(), null)));
    }

    @Test
    void blankAgentWithSystemOnlyFallsBack() {
        // 只有 system 消息（无 user）→ 无意图可判 → 透明代理
        AiChatRequest req = new AiChatRequest(List.of(new ChatMessageDto("system", "你是茶灵")), null);
        assertFalse(orchestrator.routeToLibrarian(req));
    }

    // ---- F-5：五专家显式路由 ----

    @Test
    void explicitAdvisorRoutesToAdvisor() {
        assertEquals(AgentType.ADVISOR, orchestrator.routeToAgent(req("advisor", "帮我推荐一款茶")));
    }

    @Test
    void explicitTasterRoutesToTaster() {
        assertEquals(AgentType.TASTER, orchestrator.routeToAgent(req("taster", "点评我的品鉴记录")));
    }

    @Test
    void explicitBrewerRoutesToBrewer() {
        assertEquals(AgentType.BREWER, orchestrator.routeToAgent(req("brewer", "怎么泡乌龙茶")));
    }

    @Test
    void explicitMentorRoutesToMentor() {
        assertEquals(AgentType.MENTOR, orchestrator.routeToAgent(req("mentor", "我的茶路怎么走")));
    }

    @Test
    void explicitChatRoutesToTransparent() {
        // 显式 chat → CHAT 类型（服务层回落透明代理）
        assertEquals(AgentType.CHAT, orchestrator.routeToAgent(req("chat", "你好")));
    }

    @Test
    void noAgentNonCultureReturnsNull() {
        // 无 agent + 非文化意图 → null（透明代理）
        assertNull(orchestrator.routeToAgent(req(null, "今天天气如何")));
    }

    @Test
    void unknownAgentRouteToAgentRejects400() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> orchestrator.routeToAgent(req("robot", "你好")));
        assertEquals("未知 agent 类型: robot", ex.getMessage());
    }

    // ---- T09 复杂度路由三档边界 ----

    @Test
    void shortQuestionSingleTurnIsSimple() {
        assertEquals(ComplexityLevel.SIMPLE, orchestrator.complexity(req(null, "你好")));
    }

    @Test
    void boundaryFortyWordsIsSimple() {
        String q = "这".repeat(40);
        assertEquals(ComplexityLevel.SIMPLE, orchestrator.complexity(req(null, q)));
    }

    @Test
    void overFortyWordsIsMedium() {
        String q = "这".repeat(41);
        assertEquals(ComplexityLevel.MEDIUM, orchestrator.complexity(req(null, q)));
    }

    @Test
    void overTwoHundredWordsIsComplex() {
        String q = "这".repeat(201);
        assertEquals(ComplexityLevel.COMPLEX, orchestrator.complexity(req(null, q)));
    }

    @Test
    void overThreeTurnsIsComplex() {
        assertEquals(ComplexityLevel.COMPLEX, orchestrator.complexity(
                req(null, "你好", "继续", "再说说", "还有吗")));
    }

    @Test
    void emptyMessagesIsSimple() {
        assertEquals(ComplexityLevel.SIMPLE, orchestrator.complexity(new AiChatRequest(List.of(), null)));
    }
}
