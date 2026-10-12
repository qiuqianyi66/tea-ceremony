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
    /** 2026-10-12 安全审计 H4：文化搜索公开可调且触发付费 embedding（CultureSearchService.vectorHits），纳入同档限流。 */
    private static final String CULTURE_PREFIX = "/api/v1/culture/";
    private static final String LOGIN_PATH = "/api/v1/auth/login";

    private final ObjectMapper objectMapper;
    private final int aiMax;
    private final long aiWindowMs;
    private final int loginMax;
    private final long loginWindowMs;

    /** 窗口条目：时间戳队列 + 最后活跃时间（陈旧条目清理依据）。 */
    static final class Window {
        final ArrayDeque<Long> stamps = new ArrayDeque<>();
        long lastActiveAt;
    }

    /** 包级可见供测试观测；陈旧窗口在 key 再次访问时顺带清理（防 store 无界增长）。 */
    final ConcurrentHashMap<String, Window> store = new ConcurrentHashMap<>();

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
        Window window = store.computeIfAbsent(key, k -> new Window());
        // 第一步：在拿到的窗口上修剪过期时间戳；队列空且距最后活跃超过 2 倍窗口 → 陈旧条目摘除，
        // 否则换 IP / 匿名访问会让 store 无界增长（原实现永不清理）。
        synchronized (window) {
            while (!window.stamps.isEmpty() && now - window.stamps.peekFirst() > rule.windowMs) {
                window.stamps.pollFirst();
            }
            if (window.stamps.isEmpty() && window.lastActiveAt > 0
                    && now - window.lastActiveAt > rule.windowMs * 2) {
                store.remove(key, window);
            }
        }
        // 第二步：空窗口（全新 key 或刚摘除的陈旧条目）→ 放全新窗口占槽（putIfAbsent 防并发竞态；
        // 不能放旧窗口本身——它刚被摘除，放回去等于没清理）。
        if (window.stamps.isEmpty()) {
            Window fresh = new Window();
            Window winner = store.putIfAbsent(key, fresh);
            window = winner != null ? winner : fresh;
        }
        boolean allowed;
        synchronized (window) {
            allowed = window.stamps.size() < rule.max;
            if (allowed) {
                window.stamps.addLast(now);
                window.lastActiveAt = now;
            }
        }
        if (!allowed) {
            writeRateLimited(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private LimitRule match(String uri) {
        if (uri.startsWith(AI_PREFIX) || uri.startsWith(CULTURE_PREFIX)) {
            return new LimitRule("ai", aiMax, aiWindowMs);
        }
        if (LOGIN_PATH.equals(uri)) {
            return new LimitRule("login", loginMax, loginWindowMs);
        }
        return null;
    }

    /**
     * 客户端 IP。2026-10-12 安全审计 H3：nginx 用 $proxy_add_x_forwarded_for 追加真实 remote_addr，
     * 故取 XFF 末段为真实客户端；取首段会被客户端自带 X-Forwarded-For: 任意值 逐请求轮换，直接绕过限流。
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] parts = forwarded.split(",");
            return parts[parts.length - 1].trim();
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
