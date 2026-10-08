package com.tea.ai.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tea.ai.entity.AiChatMessage;
import com.tea.ai.entity.AiChatSession;
import com.tea.ai.service.ChatMemoryService;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.auth.security.JwtAuthenticationFilter;
import com.tea.common.exception.NotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * AiSessionController slice 测试：4 端点映射、@Valid 校验、归属 404、ApiResponse 结构（F-1~F-4）。
 * 当前用户通过 SecurityContextHolder 注入（照 TastingRecordControllerTest）。
 * 游客 401 由 Security 集成测试覆盖（SecurityConfig 收窄：仅 /chat 公开，sessions 需认证 F-10）。
 */
@WebMvcTest(AiSessionController.class)
@AutoConfigureMockMvc(addFilters = false)
class AiSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ChatMemoryService memoryService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void authenticate() {
        var auth = new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(1, "u1"), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private AiChatSession session(int id) {
        AiChatSession s = new AiChatSession();
        s.setId(id);
        s.setTopic("存茶问法");
        s.setAgent("advisor");
        s.setCreatedAt(LocalDateTime.of(2026, 10, 8, 10, 0));
        s.setUpdatedAt(LocalDateTime.of(2026, 10, 8, 10, 30));
        return s;
    }

    private AiChatMessage message(int id) {
        AiChatMessage m = new AiChatMessage();
        m.setId(id);
        m.setRole("user");
        m.setContent("问");
        m.setAgent("advisor");
        m.setTokens(12);
        m.setCreatedAt(LocalDateTime.of(2026, 10, 8, 10, 0));
        return m;
    }

    @Test
    void createReturnsSessionVo() throws Exception {
        when(memoryService.createSession(1, "存茶问法", "advisor")).thenReturn(session(7));

        mockMvc.perform(post("/api/v1/ai/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topic\":\"存茶问法\",\"agent\":\"advisor\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.topic").value("存茶问法"))
                .andExpect(jsonPath("$.data.agent").value("advisor"));
    }

    @Test
    void createBlankBodyAllowed() throws Exception {
        when(memoryService.createSession(1, null, null)).thenReturn(session(7));

        mockMvc.perform(post("/api/v1/ai/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));
    }

    @Test
    void createOversizeTopicReturns400() throws Exception {
        String topic = "茶".repeat(101);
        mockMvc.perform(post("/api/v1/ai/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topic\":\"" + topic + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"));
    }

    @Test
    void listReturnsOwnSessions() throws Exception {
        when(memoryService.sessions(1)).thenReturn(List.of(session(2), session(1)));

        mockMvc.perform(get("/api/v1/ai/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data[0].id").value(2))
                .andExpect(jsonPath("$.data[1].id").value(1));
    }

    @Test
    void messagesReturnsHistory() throws Exception {
        when(memoryService.listMessages(1, 3)).thenReturn(List.of(message(1), message(2)));

        mockMvc.perform(get("/api/v1/ai/sessions/3/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].role").value("user"))
                .andExpect(jsonPath("$.data[1].tokens").value(12));
    }

    @Test
    void messagesOthersSessionReturns404() throws Exception {
        when(memoryService.listMessages(1, 99)).thenThrow(new NotFoundException("会话不存在"));

        mockMvc.perform(get("/api/v1/ai/sessions/99/messages"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("会话不存在"));
    }

    @Test
    void deleteReturnsMessage() throws Exception {
        mockMvc.perform(delete("/api/v1/ai/sessions/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("已删除"));

        verify(memoryService).deleteSession(1, 5);
    }
}
