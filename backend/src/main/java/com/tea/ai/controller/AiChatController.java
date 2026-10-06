package com.tea.ai.controller;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiChatService;
import com.tea.ai.vo.AiChatVo;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 聊天接口（/api/v1/ai/chat，公开；游客可调用，user_id 空）。
 * Controller 只做参数与响应；LLM 调用/计量/502 在 Service。
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChatService;

    @PostMapping("/chat")
    public ApiResponse<AiChatVo> chat(@AuthenticationPrincipal AuthenticatedUser user,
                                      @Valid @RequestBody AiChatRequest req) {
        Integer userId = user == null ? null : user.id();
        return ApiResponse.success(aiChatService.chat(userId, req));
    }
}
