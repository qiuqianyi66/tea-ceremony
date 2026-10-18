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
 * 规则（2026-10-13 分级加固）：aiAnonMax=2 / aiWindowMs=60s / aiAnonDailyMax=100 / aiAuthMax=30；
 * loginMax=1；窗口小值（50ms）用于过期恢复用例。
 */
class RateLimitFilterTest {

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(new ObjectMapper(), 2, 60_000, 100, 30, 1, 300_000, 3600, 60_000);
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
        RateLimitFilter shortWindow = new RateLimitFilter(new ObjectMapper(), 2, 50, 100, 30, 1, 300_000, 3600, 60_000);
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

    @Test
    void staleWindowsAreEvictedAfterTwoWindowPeriods() throws Exception {
        // 窗口 50ms；陈旧条目（队列空 + 空闲 > 2×窗口）在 key 再次访问时摘除
        RateLimitFilter shortWindow = new RateLimitFilter(new ObjectMapper(), 2, 50, 100, 30, 1, 300_000, 3600, 60_000);
        shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), newResp(), new MockFilterChain());
        shortWindow.doFilter(request("/api/v1/ai/chat", "2.2.2.2"), newResp(), new MockFilterChain());
        // 2 个 IP × 2 规则（ai-anon + ai-anon-daily）→ 4 个活跃条目
        assertThat(shortWindow.store).hasSize(4);

        Thread.sleep(120); // > 2×50ms 窗口
        // 两个 IP 再次访问：各自陈旧窗口被摘除并按全新窗口重建
        shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), newResp(), new MockFilterChain());
        shortWindow.doFilter(request("/api/v1/ai/chat", "2.2.2.2"), newResp(), new MockFilterChain());

        // 仍只有 4 个活跃条目（无无界增长），且新窗口接受请求
        assertThat(shortWindow.store).hasSize(4);
        MockHttpServletResponse third = newResp();
        shortWindow.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), third, new MockFilterChain());
        assertThat(third.getStatus()).isEqualTo(200); // 新窗口第 2 次仍放行
    }

    /** ADR-022：遥测上报单独一档（匿名 30/min），与 AI 面计数互不影响。 */
    @Test
    void telemetryBatchPathHasItsOwnLimit() throws Exception {
        RateLimitFilter strict = new RateLimitFilter(new ObjectMapper(), 2, 60_000, 100, 30, 1, 300_000,
                2, 60_000);
        for (int i = 0; i < 2; i++) {
            strict.doFilter(request("/api/v1/telemetry/batch", "1.1.1.1"), newResp(), new MockFilterChain());
        }
        MockHttpServletResponse blocked = newResp();
        strict.doFilter(request("/api/v1/telemetry/batch", "1.1.1.1"), blocked, new MockFilterChain());
        assertThat(blocked.getStatus()).isEqualTo(429);

        // 同一 IP 的 AI 面计数独立，不被遥测上报吃掉额度
        MockHttpServletResponse ai = newResp();
        strict.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), ai, new MockFilterChain());
        assertThat(ai.getStatus()).isEqualTo(200);
    }

    private MockHttpServletRequest request(String uri, String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", uri);
        req.setRemoteAddr(ip);
        return req;
    }

    private MockHttpServletRequest request(String uri, String ip, String bearerToken) {
        MockHttpServletRequest req = request(uri, ip);
        req.addHeader("Authorization", "Bearer " + bearerToken);
        return req;
    }

    private MockHttpServletResponse newResp() {
        return new MockHttpServletResponse();
    }

    // ============ 2026-10-13 匿名/登录分级 + 每日总额 ============

    /** 登录用户（带 Bearer）走 ai-auth 档（30/min），同 IP 匿名已超时仍放行。 */
    @Test
    void authenticatedAiGetsHigherLimitThanAnonymous() throws Exception {
        // 匿名 3 次 → 第 3 次 429（ai-anon 2/min）
        for (int i = 0; i < 2; i++) {
            filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), newResp(), new MockFilterChain());
        }
        MockHttpServletResponse anonBlocked = newResp();
        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), anonBlocked, new MockFilterChain());
        assertThat(anonBlocked.getStatus()).isEqualTo(429);

        // 同 IP 带登录 token：ai-auth 独立计数，放行
        for (int i = 0; i < 30; i++) {
            filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1", "jwt-token"), newResp(), new MockFilterChain());
        }
        MockHttpServletResponse authBlocked = newResp();
        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1", "jwt-token"), authBlocked, new MockFilterChain());
        assertThat(authBlocked.getStatus()).isEqualTo(429); // 第 31 次登录档超限
    }

    /** 匿名每日总额：分钟窗不超但日窗满 → 429（防慢速脚本 24h 白嫖）。 */
    @Test
    void anonymousAiDailyCapTriggers429EvenUnderMinuteLimit() throws Exception {
        // 预填日窗 100 条（当前时间戳，模拟今天 100 次额度已用尽）
        RateLimitFilter.Window daily = new RateLimitFilter.Window();
        long now = System.currentTimeMillis();
        for (int i = 0; i < 100; i++) {
            daily.stamps.addLast(now);
        }
        daily.lastActiveAt = now;
        filter.store.put("ai-anon-daily:1.1.1.1", daily);

        // 匿名第 1 次：分钟窗（2 内放行）但日窗 100 满 → 429
        MockHttpServletResponse resp = newResp();
        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), resp, new MockFilterChain());
        assertThat(resp.getStatus()).isEqualTo(429);
    }

    /** 带登录 token 不消耗匿名日窗（档位独立，避免登录用户被匿名日窗误伤）。 */
    @Test
    void authenticatedAiDoesNotConsumeAnonymousDailyCap() throws Exception {
        for (int i = 0; i < 5; i++) {
            filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1", "jwt-token"), newResp(), new MockFilterChain());
        }
        // 匿名日窗无此 IP 条目（未预填），且匿名分钟窗独立
        assertThat(filter.store.containsKey("ai-anon-daily:1.1.1.1")).isFalse();
        MockHttpServletResponse anon = newResp();
        filter.doFilter(request("/api/v1/ai/chat", "1.1.1.1"), anon, new MockFilterChain());
        assertThat(anon.getStatus()).isEqualTo(200);
    }
}
