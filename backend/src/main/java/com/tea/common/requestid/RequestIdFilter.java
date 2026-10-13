package com.tea.common.requestid;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 请求链路 ID（P1-1，OPTIMIZATION_PLAN）。
 * - 读 X-Request-ID：有则沿用（nginx 层用 $request_id 注入统一链路 id），无则生成 UUID；
 *   超长/空白请求头视为伪造，重新生成。
 * - 写入响应头 X-Request-ID + MDC requestId（logback pattern 带 [%X{requestId:-}] 贯穿日志）。
 * - @Order 最高优先级：先于限流/鉴权执行，保证全链路日志可串。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-ID";
    public static final String MDC_KEY = "requestId";
    /** 请求头最大长度（防伪造超长头；nginx $request_id 为 32 位 hex） */
    private static final int MAX_ID_LENGTH = 64;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String id = request.getHeader(HEADER);
        if (id == null || id.isBlank() || id.length() > MAX_ID_LENGTH) {
            id = UUID.randomUUID().toString().replace("-", "");
        }
        MDC.put(MDC_KEY, id);
        response.setHeader(HEADER, id);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
