package com.tea.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.errorcode.ErrorCode;
import com.tea.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 进程内存滑动窗口限流（批 3 安全审计：AI/登录公开端点无保护，旧栈 RateLimitMiddleware 迁移）。
 * 维度 IP+面；超阈值 → 429 统一 ApiResponse(RATE_LIMITED)。
 * 配置经 @Value 注入（跟随 garden.energy 模式）；环境变量沿用旧栈 RATE_LIMIT_* 名称。
 * 单实例实现（旧栈同级别）；多实例需 Redis 计票（ADR-012 方向，非本审计范围）。
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String AI_PREFIX = "/api/v1/ai/";
    private static final String LOGIN_PATH = "/api/v1/auth/login";

    private final ObjectMapper objectMapper;
    private final int aiMax;
    private final long aiWindowMs;
    private final int loginMax;
    private final long loginWindowMs;

    private final ConcurrentHashMap<String, ArrayDeque<Long>> store = new ConcurrentHashMap<>();

    public RateLimitFilter(
            ObjectMapper objectMapper,
            @Value("${tea.ratelimit.ai-max:10}") int aiMax,
            @Value("${tea.ratelimit.ai-window-ms:60000}") long aiWindowMs,
            @Value("${tea.ratelimit.login-max:10}") int loginMax,
            @Value("${tea.ratelimit.login-window-ms:300000}") long loginWindowMs) {
        this.objectMapper = objectMapper;
        this.aiMax = aiMax;
        this.aiWindowMs = aiWindowMs;
        this.loginMax = loginMax;
        this.loginWindowMs = loginWindowMs;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        LimitRule rule = match(request.getRequestURI());
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }
        long now = System.currentTimeMillis();
        String key = rule.name + ":" + clientIp(request);
        ArrayDeque<Long> window = store.computeIfAbsent(key, k -> new ArrayDeque<>());
        boolean allowed;
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > rule.windowMs) {
                window.pollFirst();
            }
            allowed = window.size() < rule.max;
            if (allowed) {
                window.addLast(now);
            }
        }
        if (!allowed) {
            writeRateLimited(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private LimitRule match(String uri) {
        if (uri.startsWith(AI_PREFIX)) {
            return new LimitRule("ai", aiMax, aiWindowMs);
        }
        if (LOGIN_PATH.equals(uri)) {
            return new LimitRule("login", loginMax, loginWindowMs);
        }
        return null;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void writeRateLimited(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.RATE_LIMITED)));
    }

    private record LimitRule(String name, int max, long windowMs) {
    }
}
