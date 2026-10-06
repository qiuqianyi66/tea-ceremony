package com.tea.auth.controller;

import com.tea.auth.dto.LoginRequest;
import com.tea.auth.dto.RegisterRequest;
import com.tea.auth.service.AuthService;
import com.tea.auth.vo.TokenVo;
import com.tea.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口（/api/v1/auth/*，编码规范 §15 API 前缀）。
 * Controller 只做参数与响应，不写业务。
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<TokenVo> register(@Valid @RequestBody RegisterRequest req) {
        return ApiResponse.success(authService.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<TokenVo> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.success(authService.login(req));
    }
}
