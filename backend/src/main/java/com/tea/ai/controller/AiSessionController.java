package com.tea.ai.controller;

import com.tea.ai.dto.SessionCreateRequest;
import com.tea.ai.service.ChatMemoryService;
import com.tea.ai.vo.MessageVo;
import com.tea.ai.vo.SessionVo;
import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 会话管理接口（/api/v1/ai/sessions/*，全部需登录——Security 已收窄，游客 401 F-10）。
 * Controller 只做参数与响应；归属校验（非本人 404 F-9）在 ChatMemoryService。
 */
@RestController
@RequestMapping("/api/v1/ai/sessions")
@RequiredArgsConstructor
public class AiSessionController {

    private final ChatMemoryService memoryService;

    @PostMapping
    public ApiResponse<SessionVo> create(@AuthenticationPrincipal AuthenticatedUser user,
                                         @Valid @RequestBody SessionCreateRequest req) {
        return ApiResponse.success(SessionVo.from(
                memoryService.createSession(user.id(), req.topic(), req.agent())));
    }

    @GetMapping
    public ApiResponse<List<SessionVo>> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return ApiResponse.success(memoryService.sessions(user.id()).stream()
                .map(SessionVo::from)
                .toList());
    }

    @GetMapping("/{id}/messages")
    public ApiResponse<List<MessageVo>> messages(@AuthenticationPrincipal AuthenticatedUser user,
                                                 @PathVariable Integer id) {
        return ApiResponse.success(memoryService.listMessages(user.id(), id).stream()
                .map(MessageVo::from)
                .toList());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, String>> delete(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @PathVariable Integer id) {
        memoryService.deleteSession(user.id(), id);
        return ApiResponse.success(Map.of("message", "已删除"));
    }
}
