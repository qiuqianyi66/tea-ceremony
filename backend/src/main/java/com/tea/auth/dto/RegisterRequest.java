package com.tea.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 注册入参。 */
public record RegisterRequest(

        @NotBlank(message = "用户名不能为空")
        @Size(min = 3, max = 50, message = "用户名长度 3-50")
        String username,

        @Size(max = 100, message = "昵称最长 100")
        String displayName,

        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 72, message = "密码长度 6-72")
        String password
) {
}
