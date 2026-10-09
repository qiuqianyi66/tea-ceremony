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
            filter.doFilter(request("/api/v1/culture/search", "1.1.1.1"), resp, new MockFilterChain());
        }
        assertThat(resp.getStatus()).isEqualTo(200);
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
