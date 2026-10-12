package com.tea.common.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RateLimitFilter 行为测试（批 3 安全审计）：AI/登录公开端点滑动窗口限流。
 * 规则：aiMax=2 / aiWindowMs=60s；loginMax=1；窗口小值（50ms）用于过期恢复用例。
 */
class RateLimitFilterTest {

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(new ObjectMapper(), 2, 60_000, 1, 300_000);
    }

    @Test
    void aiPathAllowsUpToMaxThenReturns429() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();
        for (int i = 0; i < 2; i++) {
            filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), resp, new MockFilterChain());
        }
        assertThat(resp.getStatus()).isEqualTo(200);

        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(429);
    }

    @Test
    void differentIpsHaveIndependentCounters() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();
        for (int i = 0; i < 2; i++) {
            filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), resp, new MockFilterChain());
            filter.doFilter(request("/api/v1/ai/chat", "2.2.2.2"), resp, new MockFilterChain());
        }
        assertThat(resp.getStatus()).isEqualTo(200);

        filter.doFilter(request("/api/v1/ai/chat", "2.2.2.2"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(429);
    }

    @Test
    void loginAndAiLimitsAreIndependent() throws Exception {
        // 同 IP：login 第 2 次 429
        filter.doFilter(request("/api/v1/auth/login", "1.1.1.1"), newResp(), new MockFilterChain());
        MockHttpServletResponse blocked = newResp();
        filter.doFilter(request("/api/v1/auth/login", "1.1.1.1"), blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);

        // AI 面不受 login 计数影响
        MockHttpServletResponse ai = newResp();
        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), ai, new MockFilterChain());
        assertThat(ai.getStatus()).isEqualTo(200);
    }

    @Test
    void windowExpiryAllowsRequestsAgain() throws Exception {
        RateLimitFilter shortWindow = new RateLimitFilter(new ObjectMapper(), 2, 50, 1, 300_000);
        for (int i = 0; i < 2; i++) {
            shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), newResp(), new MockFilterChain());
        }
        MockHttpServletResponse blocked = newResp();
        shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);

        Thread.sleep(60);
        MockHttpServletResponse afterExpiry = newResp();
        shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), afterExpiry, new MockFilterChain());
        assertThat(afterExpiry.getStatus()).isEqualTo(200);
    }

    @Test
    void unrelatedPathIsNeverLimited() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();
        for (int i = 0; i < 100; i++) {
            filter.doFilter(request("/api/v1/teas", "1.1.1.1"), resp, new MockFilterChain());
        }
        assertThat(resp.getStatus()).isEqualTo(200);
    }

    /** 2026-10-12 安全审计 H4：文化搜索公开可调且触发付费 embedding，纳入 AI 同档限流。 */
    @Test
    void cultureSearchPathIsLimitedLikeAi() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();
        for (int i = 0; i < 2; i++) {
            filter.doFilter(request("/api/v1/culture/search?q=茶", "1.1.1.1"), resp, new MockFilterChain());
        }
        assertThat(resp.getStatus()).isEqualTo(200);
        filter.doFilter(request("/api/v1/culture/search?q=茶", "1.1.1.1"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(429);
    }

    /**
     * 2026-10-12 安全审计 H3：客户端自带 X-Forwarded-For 首段伪造值不能绕过限流——
     * nginx $proxy_add_x_forwarded_for 把真实 remote_addr 追加在末段，限流键取末段。
     * 修复前（取首段）：每次轮换首段假 IP → 全部 200，断言失败。
     */
    @Test
    void spoofedXffFirstValueCannotBypassLimit() throws Exception {
        MockHttpServletRequest req1 = request("/api/v1/ai/chat", "10.0.0.1"); // 10.0.0.1 = nginx 真实来源
        req1.addHeader("X-Forwarded-For", "spoofed-1, 203.0.113.9");
        filter.doFilter(req1, newResp(), new MockFilterChain());

        MockHttpServletRequest req2 = request("/api/v1/ai/chat", "10.0.0.1");
        req2.addHeader("X-Forwarded-For", "spoofed-2, 203.0.113.9"); // 轮换首段假值，末段真实 IP 不变
        filter.doFilter(req2, newResp(), new MockFilterChain());

        MockHttpServletResponse blocked = newResp();
        MockHttpServletRequest req3 = request("/api/v1/ai/chat", "10.0.0.1");
        req3.addHeader("X-Forwarded-For", "spoofed-3, 203.0.113.9");
        filter.doFilter(req3, blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);
    }

    /** 末段之外的真实新 IP 不受影响（取末段不误伤其他客户端）。 */
    @Test
    void differentLastXffValueIsIndependent() throws Exception {
        MockHttpServletRequest req1 = request("/api/v1/ai/chat", "10.0.0.1");
        req1.addHeader("X-Forwarded-For", "spoofed, 203.0.113.9");
        filter.doFilter(req1, newResp(), new MockFilterChain());
        MockHttpServletRequest req2 = request("/api/v1/ai/chat", "10.0.0.1");
        req2.addHeader("X-Forwarded-For", "spoofed, 203.0.113.10"); // 末段不同 = 另一真实客户端
        MockHttpServletResponse resp2 = newResp();
        filter.doFilter(req2, resp2, new MockFilterChain());
        assertThat(resp2.getStatus()).isEqualTo(200);
    }

    private MockHttpServletRequest request(String uri, String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", uri);
        req.setRemoteAddr(ip);
        return req;
    }

    private MockHttpServletResponse newResp() {
        return new MockHttpServletResponse();
    }
}
