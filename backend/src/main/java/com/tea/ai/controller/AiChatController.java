package com.tea.ai.controller;

import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.service.AiChatService;
import com.tea.ai.vo.AiChatVo;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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

    /**
     * 流式聊天（SSE，F-1）：逐 chunk 下发文本，末事件 {@code data: [DONE]}。
     * 与整段 {@code /chat} 并存——旧前端/评测器继续走整段，口径不分裂。
     * 预流失败（无 key/熔断/越权/配额）在建立 emitter 前以普通 HTTP 状态抛出（404/429/502），
     * 前端据状态回退整段路径（承重墙 F-4）。
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@AuthenticationPrincipal AuthenticatedUser user,
                                 @Valid @RequestBody AiChatRequest req) {
        Integer userId = user == null ? null : user.id();
        return aiChatService.chatStream(userId, req);
    }
}
