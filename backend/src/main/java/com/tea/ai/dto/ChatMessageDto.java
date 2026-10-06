package com.tea.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 单条聊天消息（前端 teaAI.ts callLLM：system + user 两条）。
 */
public record ChatMessageDto(
        @NotBlank(message = "role 不能为空")
                @Pattern(regexp = "system|user|assistant", message = "role 只能是 system/user/assistant")
                String role,
        @NotBlank(message = "content 不能为空")
                @Size(max = 4000, message = "content 不超过 4000 字")
                String content) {
}
