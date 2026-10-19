package com.tea.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AdminTokenFilter 单元测试（2026-10-12 安全审计 H1）：
 * fail-closed（未配置令牌全拒）/ 错误令牌拒 / 正确令牌放行 / 非管理路径不拦截。
 */
class AdminTokenFilterTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void emptyConfiguredTokenRejectsAllAdminRequests() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilterInternal(request("POST", "/api/v1/admin/culture/chunks/backfill"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(401);
    }

    @Test
    void wrongTokenIsRejected() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "correct-token");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        MockHttpServletRequest req = request("POST", "/api/v1/admin/culture/chunks/backfill");
        req.addHeader("X-Admin-Token", "wrong-token");
        filter.doFilterInternal(req, resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(401);
    }

    @Test
    void missingTokenHeaderIsRejected() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "correct-token");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilterInternal(request("POST", "/api/v1/admin/culture/chunks/backfill"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(401);
    }

    @Test
    void correctTokenPassesThrough() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "correct-token");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        MockHttpServletRequest req = request("POST", "/api/v1/admin/culture/chunks/backfill");
        req.addHeader("X-Admin-Token", "correct-token");
        MockFilterChain chain = new MockFilterChain();
        filter.doFilterInternal(req, resp, chain);
        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isSameAs(req);
    }

    @Test
    void nonAdminPathIsNeverIntercepted() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilterInternal(request("GET", "/api/v1/culture/search?q=茶"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(200);
    }

    /**
     * 百分号编码前缀不得绕过令牌校验。
     *
     * <p>根因：filter 用 {@code getRequestURI().startsWith("/api/v1/admin/")} 做字符串前缀判断，
     * 而 Servlet 容器返回的 URI 是<b>未解码</b>的 —— {@code /api/v1/%61dmin/...} 过不了 startsWith，
     * 于是 filter 放行；但 Spring MVC 在路由时会解码并能命中同一个 handler，
     * SecurityConfig 的 {@code permitAll("/api/v1/admin/**")} 用的是 MVC 匹配器（同样解码）。
     * 两处判据语义不一致 ⇒ 唯一的 admin 闸门被绕开。
     */
    @Test
    void percentEncodedAdminPrefixIsStillRejected() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "correct-token");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilterInternal(request("POST", "/api/v1/%61dmin/culture/chunks/backfill"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(401);
    }

    /** 无尾斜杠的 {@code /api/v1/admin} 同样是管理端点：当前无 handler，但新增 handler 后即为裸奔。 */
    @Test
    void adminPathWithoutTrailingSlashIsStillRejected() throws Exception {
        AdminTokenFilter filter = new AdminTokenFilter(objectMapper, "correct-token");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilterInternal(request("GET", "/api/v1/admin"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(401);
    }

    private MockHttpServletRequest request(String method, String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRemoteAddr("127.0.0.1");
        return req;
    }
}
