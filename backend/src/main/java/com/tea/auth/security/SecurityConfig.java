package com.tea.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.common.errorcode.ErrorCode;
import com.tea.common.ratelimit.RateLimitFilter;
import com.tea.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 配置：无状态 JWT（编码规范 §7：BCrypt 哈希 + JWT）。
 * 注册/登录与健康检查放行，其余接口需认证。
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;
    private final AdminTokenFilter adminTokenFilter;
    private final ObjectMapper objectMapper;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 管理端点：唯一闸门是 AdminTokenFilter 的静态令牌（fail-closed、常量时间比较）。
                        // 这里必须 permitAll —— 否则 SecurityFilterChain 还会要求用户 JWT，
                        // 与 AdminTokenFilter 的设计意图直接冲突（它的 javadoc 写着
                        // 「管理端点不再接受用户 JWT，仅接受独立令牌头 X-Admin-Token」）。
                        // 实测症状：带正确的 X-Admin-Token 却返回「未登录或登录已过期」→
                        // 运维侧 curl 永远调不通，灰度实验只能自动回滚、无法人工止血。
                        .requestMatchers("/api/v1/admin/**").permitAll()
                        // ADR-025：/actuator/prometheus 必须 permitAll，否则 Prometheus 抓取全部 401
                        // （实测踩过：只留 /actuator/health 时，抓取端拿到的是 {"code":"UNAUTHORIZED"}，
                        //  指标系统表面接好了、实际一条数都进不来）。
                        // 它的安全边界不是鉴权而是网络可达面：backend 端口只绑宿主 127.0.0.1（compose
                        // ports: "127.0.0.1:18080:8080"），nginx 路由白名单只放行 = /actuator/health，
                        // 其余 /actuator/* 一律 404。给抓取端发 JWT 会引入会过期的凭据，反而更脆。
                        .requestMatchers("/api/v1/auth/**", "/api/v1/ai/chat", "/api/v1/culture/**",
                                "/actuator/health", "/actuator/prometheus").permitAll()
                        // M5-S2 会话管理：/api/v1/ai/sessions/** 需登录（游客 401，F-10）；仅 /chat 保持公开（前端降级链游客可用）
                        // MCP 工具协议端点（P1-1）：culture-search 只读公开知识检索，与 /api/v1/culture/** 同风险等级；
                        // 未来接入敏感工具（写操作/个人数据）时必须单独收紧鉴权
                        .requestMatchers("/mcp", "/mcp/messages").permitAll()
                        // 茶叶目录游客可浏览（PRD F2/F3；T7 只读放行）
                        .requestMatchers(HttpMethod.GET, "/api/v1/teas/**").permitAll()
                        // ADR-022：批量遥测上报匿名可写（体积上限 + 限流由 RateLimitFilter 兜），其余 /api/v1/telemetry/** 仍需 JWT
                        .requestMatchers(HttpMethod.POST, "/api/v1/telemetry/batch").permitAll()
                        .anyRequest().authenticated())
                // 未认证/无效 token 访问受保护接口 → 401 统一 ApiResponse（编码规范 §6）
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.UNAUTHORIZED)));
                }))
                // 批 3 安全审计：AI/登录公开端点限流。先注册 rateLimit 再注册 jwt，
                // 注册序决定执行序（rateLimit 最先拦截，防未认证面被压测）
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                // 2026-10-12 安全审计 H1：/api/v1/admin/** 不再接受用户 JWT，仅认独立管理令牌；
                // 执行序 rateLimit → adminToken → jwt（同锚点逐次插入，后插紧贴锚点）
                .addFilterBefore(adminTokenFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
