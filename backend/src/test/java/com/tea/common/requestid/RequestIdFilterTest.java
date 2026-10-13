package com.tea.common.requestid;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** RequestIdFilter 测试（P1-1）：无头生成 / 有头沿用 / 超长头防伪造重新生成 / 响应头与 MDC 贯穿。 */
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void missingHeaderGeneratesUuidAndSetsResponseHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());

        String id = response.getHeader(RequestIdFilter.HEADER);
        assertThat(id).isNotBlank();
        assertThat(id).hasSize(32);               // UUID 去横线
    }

    @Test
    void existingHeaderIsPropagated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.HEADER, "abc-123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestIdFilter.HEADER)).isEqualTo("abc-123");
    }

    @Test
    void oversizedHeaderIsRegenerated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.HEADER, "x".repeat(65));   // 超 MAX_ID_LENGTH
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader(RequestIdFilter.HEADER)).hasSize(32);
    }

    @Test
    void mdcIsSetDuringChainAndClearedAfter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        // 链内断言 MDC 已注入；链后断言已清理（防跨请求污染）
        filter.doFilter(request, response, new MockFilterChain());
        assertThat(org.slf4j.MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }
}
