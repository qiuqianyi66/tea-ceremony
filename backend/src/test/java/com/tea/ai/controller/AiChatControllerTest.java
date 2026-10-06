package com.tea.ai.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tea.auth.security.JwtAuthenticationFilter;
import com.tea.ai.service.AiChatService;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * AiChatController slice 测试：MVC 映射 / 输入校验 / 502 契约 / ApiResponse 结构。
 * 禁用 Security（addFilters=false）——公开放行由集成测试覆盖。
 */
@WebMvcTest(AiChatController.class)
@AutoConfigureMockMvc(addFilters = false)
class AiChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiChatService aiChatService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private static final String VALID_BODY = """
            {"messages":[{"role":"system","content":"你是茶灵"},{"role":"user","content":"你好"}]}
            """;

    @Test
    void chatReturnsContent() throws Exception {
        when(aiChatService.chat(any(), any())).thenReturn(new AiChatVo("这是 AI 回复"));

        mockMvc.perform(post("/api/v1/ai/chat").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.content").value("这是 AI 回复"));
    }

    @Test
    void emptyMessagesReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"));
    }

    @Test
    void invalidRoleReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"robot\",\"content\":\"hi\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PARAM_INVALID"));
    }

    @Test
    void llmUnavailableReturns502() throws Exception {
        when(aiChatService.chat(any(), any())).thenThrow(new BadGatewayException("AI 服务未配置"));

        mockMvc.perform(post("/api/v1/ai/chat").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("BAD_GATEWAY"));
    }
}
