package com.tea.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.errorcode.ErrorCode;
import com.tea.common.response.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.MessageDigest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

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

    private static final String ADMIN_PREFIX = "/api/v1/admin/";
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
        if (!request.getRequestURI().startsWith(ADMIN_PREFIX)) {
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

    private void writeRejected(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.UNAUTHORIZED, message)));
    }
}
