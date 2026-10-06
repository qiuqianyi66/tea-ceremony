package com.tea.auth.security;

/**
 * JWT 解析后的已认证主体（放入 SecurityContext principal）。
 */
public record AuthenticatedUser(Integer id, String username) {
}
