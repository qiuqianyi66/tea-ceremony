package com.tea.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.errorcode.ErrorCode;
import com.tea.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UriUtils;

/**
 * 管理端点访问令牌过滤器（2026-10-12 安全审计 H1）。
 *
 * <p>背景：/api/v1/admin/** 原仅要求「任意登录」。开放注册下，任意人注册账号即可触发
 * 回填端点——该端点会调用 DashScope 付费 embedding API 并写 culture_chunks 表。
 * 本项目用户表无角色字段（加角色=数据模型 L3 变更），故采用运维侧静态令牌收口：
 * 管理端点不再接受用户 JWT，仅接受独立令牌头 X-Admin-Token。
 *
 * <p>安全属性：
 * <ul>
 *   <li>fail-closed：tea.admin.token 未配置（空）→ 所有 /api/v1/admin/** 请求 401；</li>
 *   <li>常量时间比较（MessageDigest.isEqual），防计时侧信道；</li>
 *   <li>令牌只经环境变量 ADMIN_API_TOKEN 注入，不入库不进日志。</li>
 * </ul>
 */
@Slf4j
@Component
public class AdminTokenFilter extends OncePerRequestFilter {

    /**
     * 管理端点路径模式——必须与 SecurityConfig 的 {@code permitAll("/api/v1/admin/**")} <b>逐字一致</b>。
     *
     * <p>2026-10-19 实测绕过窗口：原实现是 {@code getRequestURI().startsWith("/api/v1/admin/")}
     * 字符串前缀判断，而 Servlet 容器返回的 URI 未解码 —— {@code /api/v1/%61dmin/...} 过不了 startsWith，
     * 本 filter 直接放行；但 Spring MVC 路由会解码并命中同一个 handler，SecurityConfig 的
     * permitAll 走 MVC 匹配器（同样解码）也会放行。两处判据语义不一致 ⇒ 唯一闸门被绕开。
     * 该端点会触发付费 embedding 回填，属真实经济损失面。
     */
    private static final String ADMIN_PATTERN = "/api/v1/admin/**";

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private static final String TOKEN_HEADER = "X-Admin-Token";

    private final ObjectMapper objectMapper;
    private final String adminToken;

    public AdminTokenFilter(ObjectMapper objectMapper,
                            @Value("${tea.admin.token:}") String adminToken) {
        this.objectMapper = objectMapper;
        this.adminToken = adminToken == null ? "" : adminToken;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!isAdminPath(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        if (adminToken.isEmpty()) {
            log.warn("admin endpoint called but tea.admin.token not configured: {}", request.getRequestURI());
            writeRejected(response, "管理端点未配置访问令牌（ADMIN_API_TOKEN）");
            return;
        }
        String presented = request.getHeader(TOKEN_HEADER);
        if (presented == null || !MessageDigest.isEqual(
                presented.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                adminToken.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            log.warn("admin endpoint rejected: bad or missing admin token, uri={}", request.getRequestURI());
            writeRejected(response, "管理端点访问令牌无效");
            return;
        }
        filterChain.doFilter(request, response);
    }

    /**
     * 是否管理端点：URI 先解码再按 {@link #ADMIN_PATTERN} 匹配。
     *
     * <p>解码必须先行——否则 {@code %61dmin} 这类编码前缀整条规则失效。
     * 畸形编码（如孤立的 {@code %}）不在这里吃掉：原样返回交给匹配，匹配不上就放行给 MVC，
     * 由 MVC 自己返回 400/404，避免本 filter 把畸形请求判成「管理端点」而返回语义错误的 401。
     */
    private static boolean isAdminPath(HttpServletRequest request) {
        String raw = request.getRequestURI();
        if (raw == null) {
            return false;
        }
        String decoded;
        try {
            decoded = UriUtils.decode(raw, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            decoded = raw;
        }
        return PATH_MATCHER.match(ADMIN_PATTERN, decoded);
    }

    private void writeRejected(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.UNAUTHORIZED, message)));
    }
}
